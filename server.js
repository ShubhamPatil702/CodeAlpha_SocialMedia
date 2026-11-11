require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { User, Post, Comment } = require('./models');

const app = express();
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const makeToken = u => jwt.sign({ id: u._id, username: u.username }, SECRET, { expiresIn: '7d' });
const session = u => ({ token: makeToken(u), me: { name: u.name, username: u.username } });
const valid = id => mongoose.isValidObjectId(id);

function auth(req, res, next) {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please log in first' });
  }
}

const postView = async (p, meId) => ({
  _id: p._id,
  text: p.text,
  createdAt: p.createdAt,
  author: { name: p.author.name, username: p.author.username },
  likes: p.likes.length,
  liked: p.likes.some(id => String(id) === meId),
  comments: await Comment.countDocuments({ post: p._id })
});

// ---------- Auth ----------
app.post('/api/register', wrap(async (req, res) => {
  const { name, username = '', email, password } = req.body;
  const uname = username.toLowerCase();
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  if (!/^[a-z0-9_]{3,20}$/.test(uname))
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores' });
  if (await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: uname }] }))
    return res.status(409).json({ error: 'Email or username is already taken' });
  const user = await User.create({ name, username: uname, email, password: await bcrypt.hash(password, 10) });
  res.json(session(user));
}));

app.post('/api/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json(session(user));
}));

// ---------- Posts ----------
app.get('/api/posts', auth, wrap(async (req, res) => {
  const filter = {};
  if (req.query.scope === 'following') {
    const me = await User.findById(req.user.id);
    filter.author = { $in: [...me.following, me._id] };
  }
  if (req.query.user) {
    const u = await User.findOne({ username: String(req.query.user).toLowerCase() });
    filter.author = u ? u._id : null;
  }
  const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(50).populate('author', 'name username');
  res.json(await Promise.all(posts.map(p => postView(p, req.user.id))));
}));

app.post('/api/posts', auth, wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text || text.length > 280) return res.status(400).json({ error: 'Posts must be 1 to 280 characters' });
  const post = await Post.create({ author: req.user.id, text });
  res.json(await postView(await post.populate('author', 'name username'), req.user.id));
}));

app.delete('/api/posts/:id', auth, wrap(async (req, res) => {
  const post = valid(req.params.id) && await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (String(post.author) !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
  await post.deleteOne();
  await Comment.deleteMany({ post: post._id });
  res.json({ ok: true });
}));

app.post('/api/posts/:id/like', auth, wrap(async (req, res) => {
  const post = valid(req.params.id) && await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const liked = post.likes.some(id => String(id) === req.user.id);
  await Post.updateOne({ _id: post._id }, liked ? { $pull: { likes: req.user.id } } : { $addToSet: { likes: req.user.id } });
  const fresh = await Post.findById(post._id);
  res.json({ liked: !liked, likes: fresh.likes.length });
}));

// ---------- Comments ----------
app.get('/api/posts/:id/comments', auth, wrap(async (req, res) => {
  if (!valid(req.params.id)) return res.status(404).json({ error: 'Post not found' });
  const list = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).populate('author', 'name username');
  res.json(list.map(c => ({ _id: c._id, text: c.text, author: { name: c.author.name, username: c.author.username } })));
}));

app.post('/api/posts/:id/comments', auth, wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text || text.length > 280) return res.status(400).json({ error: 'Comments must be 1 to 280 characters' });
  if (!valid(req.params.id) || !(await Post.exists({ _id: req.params.id }))) return res.status(404).json({ error: 'Post not found' });
  const c = await Comment.create({ post: req.params.id, author: req.user.id, text });
  const me = await User.findById(req.user.id);
  res.json({ _id: c._id, text: c.text, author: { name: me.name, username: me.username } });
}));

// ---------- Profiles and follow ----------
app.get('/api/users/:username', auth, wrap(async (req, res) => {
  const u = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    name: u.name, username: u.username, bio: u.bio,
    followers: u.followers.length, following: u.following.length,
    isMe: String(u._id) === req.user.id,
    isFollowing: u.followers.some(id => String(id) === req.user.id)
  });
}));

app.post('/api/users/:username/follow', auth, wrap(async (req, res) => {
  const target = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (String(target._id) === req.user.id) return res.status(400).json({ error: "You can't follow yourself" });
  const following = target.followers.some(id => String(id) === req.user.id);
  const [op, inv] = following ? ['$pull', '$pull'] : ['$addToSet', '$addToSet'];
  await User.updateOne({ _id: target._id }, { [op]: { followers: req.user.id } });
  await User.updateOne({ _id: req.user.id }, { [inv]: { following: target._id } });
  const fresh = await User.findById(target._id);
  res.json({ isFollowing: !following, followers: fresh.followers.length });
}));

app.put('/api/me', auth, wrap(async (req, res) => {
  const bio = String(req.body.bio || '').slice(0, 160);
  await User.updateOne({ _id: req.user.id }, { bio });
  res.json({ bio });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error, try again' });
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codealpha_social')
  .then(() => app.listen(process.env.PORT || 3001, () =>
    console.log(`Loop running at http://localhost:${process.env.PORT || 3001}`)))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
