/*
 * Shared ProfileHub app factory — used by victim-server.js and victim-protected-server.js
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];

function freshUsers() {
  return [
    { id: 1, username: 'alice', password: 'alice123', email: 'alice@profilehub.com', bio: 'Software engineer. Coffee enthusiast.', jobTitle: 'Senior Engineer', company: 'Acme Corp', isAdmin: false, isPremium: false, plan: 'free' },
    { id: 2, username: 'bob', password: 'bob123', email: 'bob@profilehub.com', bio: 'Product designer with 8 years experience.', jobTitle: 'Lead Designer', company: 'Designco', isAdmin: false, isPremium: true, plan: 'pro' },
    { id: 3, username: 'charlie', password: 'charlie123', email: 'charlie@profilehub.com', bio: 'Startup founder, ex-FAANG.', jobTitle: 'Founder & CEO', company: 'StartupXYZ', isAdmin: false, isPremium: true, plan: 'pro' },
    { id: 4, username: 'admin', password: 'admin123', email: 'admin@profilehub.com', bio: 'Platform administrator.', jobTitle: 'Platform Admin', company: 'ProfileHub', isAdmin: true, isPremium: true, plan: 'admin' },
  ];
}

function createProfileHubApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;

  let users = freshUsers();
  const sessions = new Map();

  const app = express();
  app.use(cors({ origin: 'http://localhost:3047' }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  function publicUser(u) {
    if (isProtected) {
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        bio: u.bio,
        jobTitle: u.jobTitle,
        company: u.company,
      };
    }
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      bio: u.bio,
      jobTitle: u.jobTitle,
      company: u.company,
      isAdmin: u.isAdmin,
      isPremium: u.isPremium,
      plan: u.plan,
    };
  }

  function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const userId = sessions.get(token);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    req.user = users.find(function (u) { return u.id === userId; });
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  }

  app.get('/api/config', function (req, res) {
    res.json({ mode: isProtected ? 'protected' : 'vulnerable', port: port });
  });

  app.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/edit', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'edit.html'));
  });

  app.get('/admin', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });

  app.post('/api/reset', function (req, res) {
    users = freshUsers();
    sessions.clear();
    res.json({ message: 'Demo reset' });
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = users.find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, user.id);
    res.json({ token: token, user: publicUser(user) });
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    sessions.delete(req.headers.authorization.slice(7));
    res.json({ message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(publicUser(req.user));
  });

  app.patch('/api/profile', requireAuth, function (req, res) {
    if (isProtected) {
      const update = {};
      ALLOWED_PROFILE_FIELDS.forEach(function (field) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          update[field] = req.body[field];
        }
      });
      Object.assign(req.user, update);
    } else {
      Object.assign(req.user, req.body);
    }
    res.json(publicUser(req.user));
  });

  app.get('/api/admin/users', requireAuth, function (req, res) {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    res.json(users.map(publicUser));
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createProfileHubApp, freshUsers, ALLOWED_PROFILE_FIELDS };
