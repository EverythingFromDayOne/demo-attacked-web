/*
 * Terminal 1: cd demo-attacked/command-injection && npm install && npm run vulnerable
 * Attack guide: npm run guide → http://localhost:3038
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();
const PORT = 3037;
const IS_WIN = process.platform === 'win32';
const PING_FLAG = IS_WIN ? '-n 4' : '-c 4';

const USERS = [
  { username: 'alice', password: 'alice123', role: 'developer' },
  { username: 'bob', password: 'bob123', role: 'developer' },
  { username: 'admin', password: 'admin456', role: 'admin' },
];

const sessions = new Map();

app.use(cors({ origin: 'http://localhost:3038' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'vulnerable', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = session;
  next();
}

app.post('/api/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  const user = USERS.find(function (u) {
    return u.username === username && u.password === password;
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: user.username, role: user.role });
  res.json({ token: token, user: { username: user.username, role: user.role } });
});

app.get('/api/me', requireAuth, function (req, res) {
  res.json(req.user);
});

app.post('/api/logout', requireAuth, function (req, res) {
  const token = req.headers.authorization.slice(7);
  sessions.delete(token);
  res.json({ message: 'Logged out' });
});

app.post('/api/ping', requireAuth, function (req, res) {
  const hostname = req.body.hostname || '';
  const command = 'ping ' + PING_FLAG + ' ' + hostname;
  exec(command, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/dns', requireAuth, function (req, res) {
  const hostname = req.body.hostname || '';
  exec('nslookup ' + hostname, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/http-check', requireAuth, function (req, res) {
  const url = req.body.url || '';
  exec('curl -I --max-time 5 ' + url, { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.listen(PORT, function () {
  console.log('NetProbe (vulnerable) running at http://localhost:' + PORT);
});
