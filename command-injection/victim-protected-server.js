/*
 * Terminal 3: cd demo-attacked/command-injection && npm run secure
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { execFile } = require('child_process');

const app = express();
const PORT = 3039;
const IS_WIN = process.platform === 'win32';
const PING_ARGS = IS_WIN ? ['-n', '4'] : ['-c', '4'];

const USERS = [
  { username: 'alice', password: 'alice123', role: 'developer' },
  { username: 'bob', password: 'bob123', role: 'developer' },
  { username: 'admin', password: 'admin456', role: 'admin' },
];

const sessions = new Map();

const INVALID_HOST_MSG =
  'Invalid hostname: only alphanumeric characters, hyphens, and dots are allowed';

app.use(cors({ origin: 'http://localhost:3038' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function isValidHostname(input) {
  if (!input || typeof input !== 'string') return false;
  if (input.length > 253) return false;
  const hostnamePattern =
    /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnamePattern.test(input);
}

function isValidUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  const hostname = req.body.hostname;
  if (!isValidHostname(hostname)) {
    return res.status(400).json({ error: INVALID_HOST_MSG });
  }
  execFile('ping', PING_ARGS.concat(hostname), { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/dns', requireAuth, function (req, res) {
  const hostname = req.body.hostname;
  if (!isValidHostname(hostname)) {
    return res.status(400).json({ error: INVALID_HOST_MSG });
  }
  execFile('nslookup', [hostname], { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.post('/api/http-check', requireAuth, function (req, res) {
  const url = req.body.url;
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL: must be http:// or https://' });
  }
  execFile('curl', ['-I', '--max-time', '5', url], { timeout: 10000 }, function (error, stdout, stderr) {
    res.json({ output: stdout || stderr, error: error ? error.message : undefined });
  });
});

app.listen(PORT, function () {
  console.log('NetProbe (protected) running at http://localhost:' + PORT);
});
