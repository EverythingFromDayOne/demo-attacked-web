/*
 * Terminal 3: cd demo-attacked/nosql-injection && npm run secure
 */

const path = require('path');
const express = require('express');

const app = express();
const PORT = 3024;

const users = [
  { id: 1, username: 'alice', password: 'hunter2', role: 'developer', email: 'alice@devteam.io', team: 'Frontend' },
  { id: 2, username: 'bob', password: 'correct-horse', role: 'developer', email: 'bob@devteam.io', team: 'Backend' },
  { id: 3, username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin', email: 'admin@devteam.io', team: 'Platform' },
  { id: 4, username: 'carol', password: 'letmein', role: 'developer', email: 'carol@devteam.io', team: 'DevOps' },
];

function evaluateCondition(fieldValue, condition) {
  if (typeof condition !== 'object' || condition === null) {
    return fieldValue === condition;
  }
  if ('$gt' in condition) return fieldValue > condition['$gt'];
  if ('$gte' in condition) return fieldValue >= condition['$gte'];
  if ('$lt' in condition) return fieldValue < condition['$lt'];
  if ('$ne' in condition) return fieldValue !== condition['$ne'];
  if ('$regex' in condition) {
    return new RegExp(condition['$regex'], condition['$options'] || '').test(fieldValue);
  }
  if ('$exists' in condition) {
    return condition['$exists'] ? fieldValue !== undefined : fieldValue === undefined;
  }
  return false;
}

function findOne(query) {
  return users.find(function (user) {
    return Object.keys(query).every(function (key) {
      return evaluateCondition(user[key], query[key]);
    });
  }) || null;
}

function findUser(username) {
  return users.find(function (u) { return u.username === username; }) || null;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    team: user.team,
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/api/users', function (req, res) {
  res.json(users.map(publicUser));
});

app.get('/api/me', function (req, res) {
  const user = findUser(req.query.user);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(publicUser(user));
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ PROTECTED: reject non-string body fields.
// MongoDB operators only execute when the query field is an object.
// Enforcing typeof === 'string' means the query always uses exact equality.
app.post('/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.redirect('/login?error=1');
  }

  const user = findOne({ username: username, password: password });

  if (!user) {
    return res.redirect('/login?error=1');
  }

  res.cookie('session', user.username, { httpOnly: true, path: '/' });
  res.redirect('/dashboard?user=' + encodeURIComponent(user.username));
});

app.get('/dashboard', function (req, res) {
  const username = req.query.user;
  if (!username) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logout', function (req, res) {
  res.clearCookie('session');
  res.redirect('/login');
});

app.listen(PORT, function () {
  console.log('DevAuth (PROTECTED) running at http://localhost:' + PORT);
});
