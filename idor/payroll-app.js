/*
 * Shared PayrollHub app factory — used by victim-server.js and victim-protected-server.js
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function initDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      full_name TEXT,
      department TEXT
    );

    CREATE TABLE payslips (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      period TEXT,
      gross_pay INTEGER,
      tax_withheld INTEGER,
      net_pay INTEGER,
      annual_salary INTEGER,
      department TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    INSERT INTO users VALUES
      (1, 'alice',  'alice123',  'Alice Chen',      'Engineering'),
      (2, 'bob',    'bob123',    'Bob Martinez',    'Engineering'),
      (3, 'charlie','charlie123','Charlie Kim',     'Management'),
      (4, 'hr',     'hr_admin',  'Dana (HR)',        'Human Resources');

    INSERT INTO payslips VALUES
      (1,  1, 'June 2026',   7083,  1558,  5525,  85000, 'Engineering'),
      (2,  1, 'May 2026',    7083,  1558,  5525,  85000, 'Engineering'),
      (3,  1, 'April 2026',  7083,  1558,  5525,  85000, 'Engineering'),
      (4,  2, 'June 2026',   7667,  1687,  5980,  92000, 'Engineering'),
      (5,  2, 'May 2026',    7667,  1687,  5980,  92000, 'Engineering'),
      (6,  2, 'April 2026',  7667,  1687,  5980,  92000, 'Engineering'),
      (7,  3, 'June 2026',  10417,  2292,  8125, 125000, 'Management'),
      (8,  3, 'May 2026',   10417,  2292,  8125, 125000, 'Management'),
      (9,  3, 'April 2026', 10417,  2292,  8125, 125000, 'Management'),
      (10, 4, 'June 2026',  15000,  3300, 11700, 180000, 'Human Resources'),
      (11, 4, 'May 2026',   15000,  3300, 11700, 180000, 'Human Resources'),
      (12, 4, 'April 2026', 15000,  3300, 11700, 180000, 'Human Resources');
  `);
  return db;
}

function createPayrollApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;

  const app = express();
  const db = initDb();
  const sessions = new Map();

  app.use(cors({ origin: 'http://localhost:3041' }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  function requireAuth(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    req.user = session;
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

  app.get('/payslip', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'payslip.html'));
  });

  app.get('/profile', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, username: user.username, fullName: user.full_name });
    res.json({
      token: token,
      user: { id: user.id, username: user.username, fullName: user.full_name },
    });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(req.user);
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    const token = req.headers.authorization.slice(7);
    sessions.delete(token);
    res.json({ message: 'Logged out' });
  });

  app.get('/api/payslips', requireAuth, function (req, res) {
    const payslips = db.prepare('SELECT * FROM payslips WHERE user_id = ?').all(req.user.id);
    res.json(payslips);
  });

  app.get('/api/payslips/:id', requireAuth, function (req, res) {
    let payslip;
    if (isProtected) {
      // ✅ PROTECTED — ownership check: id AND user_id must match. Returns 404
      //    (not 403) when denied — 403 would confirm the record exists (info leak).
      payslip = db.prepare('SELECT * FROM payslips WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
    } else {
      // ⚠️ VULNERABLE — fetches by id only; no check that req.user.id owns this payslip.
      //    Sequential IDs (1–12) let any logged-in user enumerate every employee's salary.
      payslip = db.prepare('SELECT * FROM payslips WHERE id = ?').get(req.params.id);
      if (!payslip) return res.status(404).json({ error: 'Not found' });
    }
    res.json(payslip);
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createPayrollApp };
