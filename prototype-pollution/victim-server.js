/*
 * Terminal 1: cd demo-attacked/prototype-pollution && npm install && npm run vulnerable
 * Attack guide: npm run guide → http://localhost:3029
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3028;

// Intentionally vulnerable JSON parsing — express.json() strips __proto__ keys,
// which would prevent the demo from showing real prototype pollution via HTTP.
function parseJsonBody(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', function (chunk) { data += chunk; });
  req.on('end', function () {
    try {
      req.body = data ? JSON.parse(data) : {};
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON body' });
    }
  });
}

const presets = [
  { id: 1, name: 'ESLint Base', config: { rules: { 'no-console': 'warn' }, env: { node: true } } },
  { id: 2, name: 'Webpack Dev', config: { mode: 'development', devtool: 'source-map' } },
  { id: 3, name: 'TypeScript Strict', config: { strict: true, noImplicitAny: true } },
];

// ⚠️ VULNERABLE — for...in iterates inherited keys, and target['__proto__']
// resolves to Object.prototype, so merge() mutates the global prototype.
function merge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'vulnerable', port: PORT });
});

app.get('/api/presets', function (req, res) {
  res.json({ presets: presets });
});

app.get('/api/admin-status', function (req, res) {
  const user = {};
  if (user.isAdmin) {
    res.json({ granted: true, presets: presets });
  } else {
    res.json({ granted: false });
  }
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/merge', parseJsonBody, function (req, res) {
  const base = req.body.base;
  const patch = req.body.patch;

  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return res.status(400).json({ error: 'base must be a plain object' });
  }
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return res.status(400).json({ error: 'patch must be a plain object' });
  }

  const result = merge(base, patch);
  res.json({ result: result });
});

app.get('/api/proto-check', function (req, res) {
  const probe = {};
  res.json({
    isAdmin: probe.isAdmin,
    role: probe.role,
    polluted: probe.isAdmin === true,
  });
});

app.listen(PORT, function () {
  console.log('ConfigHub (vulnerable) running at http://localhost:' + PORT);
});
