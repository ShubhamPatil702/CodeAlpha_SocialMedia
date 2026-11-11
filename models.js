const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = name => ({ type: Schema.Types.ObjectId, ref: name });

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  bio: { type: String, default: '', maxlength: 160 },
  followers: [ref('User')],
  following: [ref('User')]
}, { timestamps: true }));

const Post = mongoose.model('Post', new Schema({
  author: { ...ref('User'), required: true },
  text: { type: String, required: true, maxlength: 280 },
  likes: [ref('User')]
}, { timestamps: true }));

const Comment = mongoose.model('Comment', new Schema({
  post: { ...ref('Post'), required: true },
  author: { ...ref('User'), required: true },
  text: { type: String, required: true, maxlength: 280 }
}, { timestamps: true }));

module.exports = { User, Post, Comment };
