/*
 * Terminal 1: cd demo-attacked/jwt-attacks && npm install && npm run vulnerable
 * Attack lab: npm run guide → http://localhost:3035
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');

const app = express();
const PORT = 3034;

const JWT_SECRET = 'secret';
const JWT_EXPIRES = '2h';

// In-memory denylist — stores jti values of logged-out tokens
const tokenDenylist = new Set();

const USERS = [
  { id: 1, username: 'alice', password: 'hunter2', role: 'developer' },
  { id: 2, username: 'bob', password: 'correct-horse', role: 'developer' },
  { id: 3, username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin' },
];

app.use(cors({ origin: 'http://localhost:3035' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());

    if (header.alg === 'none') {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.jti && tokenDenylist.has(payload.jti)) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      req.user = payload;
      return next();
    }

    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.jti && tokenDenylist.has(req.user.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token error: ' + err.message });
  }
}

app.get('/api/config', function (req, res) {
  res.json({ mode: 'vulnerable', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin-panel', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  const user = USERS.find(function (u) {
    return u.username === username && u.password === password;
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      jti: randomBytes(16).toString('hex'),
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES }
  );
  res.json({ token: token, user: { username: user.username, role: user.role } });
});

app.post('/api/logout', verifyToken, function (req, res) {
  if (req.user.jti) {
    tokenDenylist.add(req.user.jti);
  }
  res.json({ message: 'Logged out — token revoked' });
});

app.get('/api/profile', verifyToken, function (req, res) {
  res.json(req.user);
});

app.get('/api/whoami', verifyToken, function (req, res) {
  res.json(req.user);
});

app.get('/api/admin', verifyToken, function (req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  res.json({
    users: USERS.map(function (u) {
      return {
        username: u.username,
        role: u.role,
        apiKey: 'sk_live_' + u.username + '_' + String(u.id).padStart(4, '0') + '_SECRET',
      };
    }),
  });
});

app.listen(PORT, function () {
  console.log('AuthVault (vulnerable) running at http://localhost:' + PORT);
});
