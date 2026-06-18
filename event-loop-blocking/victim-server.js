/*
 * Terminal 1: cd demo-attacked/event-loop-blocking && npm install && npm run vulnerable
 * Attack console: npm run guide → http://localhost:3032
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3031;

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', function (req, res) {
  res.json({ mode: 'vulnerable', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function runCompute(n) {
  let result = 0;
  // ⚠️ VULNERABLE — synchronous CPU loop on the main thread. While this runs,
  //    ALL concurrent requests (including /health) receive no response — one
  //    slow request starves every other client until the computation finishes.
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
  }
  return { result, iterations: n };
}

app.get('/health', function (req, res) {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/compute', function (req, res) {
  const n = parseInt(req.query.n, 10) || 1000;
  const data = runCompute(n);
  res.json(data);
});

app.post('/api/compute', function (req, res) {
  const n = parseInt(req.body.n, 10) || 1000;
  const data = runCompute(n);
  res.json(data);
});

app.post('/api/regex', function (req, res) {
  const pattern = req.body.pattern;
  const text = req.body.text || '';
  // ⚠️ VULNERABLE — user-supplied regex with no timeout or complexity limit.
  //    Catastrophic backtracking (e.g. (a+)+$ on a long string) blocks the main
  //    thread indefinitely — same starvation effect as the CPU attack.
  const re = new RegExp(pattern);
  const match = re.test(text);
  res.json({ match: match, pattern: pattern, textLength: text.length });
});

app.listen(PORT, function () {
  console.log('DevUtils (vulnerable) running at http://localhost:' + PORT);
});
