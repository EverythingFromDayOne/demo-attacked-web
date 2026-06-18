/*
 * Terminal 3: cd demo-attacked/sql-injection && npm run secure
 */

const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3027;

const SEED_RESOURCES = [
  { title: 'V8 Engine Deep Dive', url: 'https://v8.dev/blog', tags: 'javascript,engine', author: 'alice' },
  { title: 'Node.js Performance Guide', url: 'https://nodejs.org/docs', tags: 'nodejs,performance', author: 'bob' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', tags: 'reference,web', author: 'carol' },
  { title: 'CSS Grid Complete Guide', url: 'https://css-tricks.com/snippets/css/complete-guide-grid', tags: 'css,layout', author: 'alice' },
  { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook', tags: 'typescript,types', author: 'dave' },
];

const SEED_USERS = [
  { username: 'alice', password: 'hunter2', role: 'developer', email: 'alice@devlinks.io' },
  { username: 'bob', password: 'correct-horse', role: 'developer', email: 'bob@devlinks.io' },
  { username: 'admin', password: 'Adm1nS3cr3t!', role: 'admin', email: 'admin@devlinks.io' },
  { username: 'carol', password: 'letmein', role: 'developer', email: 'carol@devlinks.io' },
];

function initDb() {
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE resources (
      id      INTEGER PRIMARY KEY,
      title   TEXT NOT NULL,
      url     TEXT NOT NULL,
      tags    TEXT,
      author  TEXT
    );
    CREATE TABLE users (
      id       INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role     TEXT NOT NULL,
      email    TEXT NOT NULL
    );
  `);

  const insertResource = db.prepare(
    'INSERT INTO resources (title, url, tags, author) VALUES (?, ?, ?, ?)'
  );
  SEED_RESOURCES.forEach(function (row) {
    insertResource.run(row.title, row.url, row.tags, row.author);
  });

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)'
  );
  SEED_USERS.forEach(function (row) {
    insertUser.run(row.username, row.password, row.role, row.email);
  });

  return db;
}

const db = initDb();

function hasAdminCookie(req) {
  return /(?:^|;\s*)devlinks_admin=1(?:;|$)/.test(req.headers.cookie || '');
}

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/api/resources', function (req, res) {
  const resources = db.prepare('SELECT id, title, url, tags, author FROM resources').all();
  res.json({ resources });
});

app.get('/api/session', function (req, res) {
  const isAdmin = hasAdminCookie(req);
  const payload = { isAdmin };
  if (isAdmin) {
    payload.users = db.prepare('SELECT id, username, password, role, email FROM users').all();
  }
  res.json(payload);
});

// ✅ PROTECTED SEARCH — parameterized LIKE; user input is always data, never SQL syntax
app.get('/api/search', function (req, res) {
  const q = req.query.q || '';
  let results = [];
  let error = null;

  try {
    results = db.prepare(
      'SELECT id, title, url, tags, author FROM resources WHERE title LIKE ? OR tags LIKE ?'
    ).all('%' + q + '%', '%' + q + '%');
  } catch (err) {
    error = err.message;
  }

  res.json({ results, error });
});

function sendIndex(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
}

app.get('/', sendIndex);
app.get('/search', sendIndex);
app.get('/admin', sendIndex);
app.get('/admin/dashboard', sendIndex);

// ✅ PROTECTED LOGIN — parameterized WHERE; admin'-- is treated as a literal username
app.post('/login', function (req, res) {
  const username = req.body.username || '';
  const password = req.body.password || '';

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).get(username, password);

  if (!user) {
    return res.redirect('/admin?error=1');
  }

  res.setHeader('Set-Cookie', 'devlinks_admin=1; Path=/');
  res.redirect('/admin/dashboard');
});

app.listen(PORT, function () {
  console.log('DevLinks (PROTECTED) running at http://localhost:' + PORT);
});
