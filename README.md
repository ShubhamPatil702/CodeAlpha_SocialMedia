# CodeAlpha_SocialMedia

CodeAlpha Full Stack Internship, Task 2: a mini social media platform called Loop.

## Features
- Register and log in (bcrypt + JWT)
- User profiles with an editable bio, follower and following counts
- Posts (280 characters), delete your own posts
- Comments on posts
- Like and unlike
- Follow and unfollow, with a Following feed
- Everyone feed and per-user profile feed

## Tech
HTML, CSS, JavaScript | Node.js, Express | MongoDB (Mongoose)

## Run locally
1. Install Node.js and MongoDB (or use a free MongoDB Atlas URI)
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`
4. `npm start`, then open http://localhost:3001
5. Create two accounts in two browsers to try follow, like and comment

## API
| Method | Route |
|---|---|
| POST | /api/register, /api/login |
| GET | /api/posts?scope=following or ?user=username |
| POST | /api/posts |
| DELETE | /api/posts/:id |
| POST | /api/posts/:id/like |
| GET, POST | /api/posts/:id/comments |
| GET | /api/users/:username |
| POST | /api/users/:username/follow |
| PUT | /api/me |

All routes except register and login need a Bearer token.
