/*
 * Shared FileVault app factory — used by victim-server.js and victim-protected-server.js
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');

const USERS = [
  { id: 1, username: 'alice', password: 'alice123' },
  { id: 2, username: 'bob', password: 'bob123' },
];

const SEEDED_FILES = ['q2-report.txt', 'meeting-notes.txt', 'readme.txt'];

function seedUploadsDir(baseDir) {
  const uploadsDir = path.join(baseDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  fs.writeFileSync(
    path.join(uploadsDir, 'q2-report.txt'),
    'Q2 Financial Report\n====================\nRevenue: $1,240,000\nExpenses: $890,000\nNet: $350,000\n'
  );
  fs.writeFileSync(
    path.join(uploadsDir, 'meeting-notes.txt'),
    'Meeting Notes — 2026-06-15\n==========================\nAttendees: Alice, Bob, Charlie\nDecision: Launch delayed to Q3.\n'
  );
  fs.writeFileSync(
    path.join(uploadsDir, 'readme.txt'),
    'FileVault — Private Document Storage\nUpload your files here. Only you can access them.\n'
  );

  return uploadsDir;
}

function createFileVaultApp(options) {
  const port = options.port;
  const isProtected = options.protected;
  const label = options.label;
  const baseDir = __dirname;

  seedUploadsDir(baseDir);

  const app = express();
  const sessions = new Map();

  app.use(cors({ origin: 'http://localhost:3044' }));
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

  app.get('/upload', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
  });

  app.post('/api/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = USERS.find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.id, username: user.username });
    res.json({ token: token, user: { username: user.username } });
  });

  app.post('/api/logout', requireAuth, function (req, res) {
    sessions.delete(req.headers.authorization.slice(7));
    res.json({ message: 'Logged out' });
  });

  app.get('/api/me', requireAuth, function (req, res) {
    res.json(req.user);
  });

  app.get('/api/files', requireAuth, function (req, res) {
    res.json(SEEDED_FILES);
  });

  app.get('/api/download', requireAuth, function (req, res) {
    const filename = req.query.file;
    if (!filename) return res.status(400).json({ error: 'No file specified' });

    if (isProtected) {
      const uploadsDir = path.resolve(baseDir, 'uploads');
      const requestedPath = path.resolve(uploadsDir, filename);

      // ✅ PROTECTED — path.resolve() + startsWith(baseDir) enforces containment.
      //    path.join() alone normalises ../ but does NOT prevent escape outside uploads/.
      if (!requestedPath.startsWith(uploadsDir + path.sep)) {
        return res.status(403).json({ error: 'Access denied: path traversal detected' });
      }

      if (!fs.existsSync(requestedPath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const content = fs.readFileSync(requestedPath, 'utf8');
      return res.json({ filename: filename, content: content });
    }

    const filePath = path.join(baseDir, 'uploads', filename);
    // ⚠️ VULNERABLE — path.join() normalises ../ sequences but does NOT verify
    //    the result stays inside uploads/. Payload ../../victim-server.js reads
    //    arbitrary files the Node.js process can access.
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ filename: filename, content: content });
  });

  app.listen(port, function () {
    console.log(label + ' running at http://localhost:' + port);
  });
}

module.exports = { createFileVaultApp };
