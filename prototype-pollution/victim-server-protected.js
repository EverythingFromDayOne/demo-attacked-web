/*
 * Terminal 3: cd demo-attacked/prototype-pollution && npm run secure
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3030;

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

// ✅ PROTECTED — Object.keys() only returns own enumerable keys (not inherited),
// and the blocklist explicitly rejects __proto__, constructor, prototype.
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = Object.create(null);
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
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

  const result = safeMerge(base, patch);
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
  console.log('ConfigHub (protected) running at http://localhost:' + PORT);
});
