/*
 * How to Run:
 *
 * Terminal 3: cd demo-attacked/ssrf && npm run secure
 *
 * Protected demo:
 * 1. http://localhost:3021  ← DevShare (protected)
 * 2. Paste http://localhost:3020/internal/env → blocked with validation message
 */

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { buildPreviewFromFetch, isUrlSafe } = require('./preview-utils');

const app = express();
const PORT = 3021;

const SESSION_VALUE = 'DevUser_demo_TOKEN_999';

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

app.use(function (req, res, next) {
  if (req.cookies.devshare_session !== SESSION_VALUE) {
    res.cookie('devshare_session', SESSION_VALUE, { httpOnly: false, path: '/' });
  }
  next();
});

app.get('/api/config', function (req, res) {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/preview', async function (req, res) {
  const url = (req.body && req.body.url) ? String(req.body.url).trim() : '';

  if (!url) {
    return res.json({ success: false, error: 'URL is required' });
  }

  const safety = isUrlSafe(url);
  if (!safety.safe) {
    return res.json({ blocked: true, reason: safety.reason });
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await response.text();
    res.json(buildPreviewFromFetch(url, response, body));
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, function () {
  console.log('DevShare (PROTECTED) running at http://localhost:' + PORT);
});
