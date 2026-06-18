/*
 * Terminal 3: cd demo-attacked/event-loop-blocking && npm run secure
 */

const express = require('express');
const path = require('path');
const { Worker } = require('worker_threads');

const app = express();
const PORT = 3033;
const WORKER_PATH = path.join(__dirname, 'worker.js');

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
  res.json({ mode: 'protected', port: PORT });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function runComputeInWorker(n) {
  return new Promise(function (resolve, reject) {
    const worker = new Worker(WORKER_PATH, { workerData: { type: 'compute', n: n } });
    const timeout = setTimeout(function () {
      worker.terminate();
      reject(new Error('Computation timed out after 10s'));
    }, 10000);

    worker.once('message', function (data) {
      clearTimeout(timeout);
      resolve(data);
    });
    worker.once('error', function (err) {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function runRegexInWorker(pattern, text) {
  return new Promise(function (resolve, reject) {
    const worker = new Worker(WORKER_PATH, {
      workerData: { type: 'regex', pattern: pattern, text: text },
    });
    const timeout = setTimeout(function () {
      worker.terminate();
      reject(new Error('Regex timed out — pattern may cause catastrophic backtracking'));
    }, 5000);

    worker.once('message', function (data) {
      clearTimeout(timeout);
      resolve(data);
    });
    worker.once('error', function (err) {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function handleCompute(req, res) {
  const raw = req.method === 'GET' ? req.query.n : req.body.n;
  const n = Math.min(parseInt(raw, 10) || 1000, 100000000);

  runComputeInWorker(n)
    .then(function (data) {
      res.json(data);
    })
    .catch(function (err) {
      const status = err.message.indexOf('timed out') >= 0 ? 408 : 500;
      res.status(status).json({ error: err.message });
    });
}

app.get('/health', function (req, res) {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/compute', handleCompute);

app.post('/api/compute', handleCompute);

app.post('/api/regex', function (req, res) {
  const pattern = req.body.pattern;
  const text = req.body.text || '';

  try {
    new RegExp(pattern);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid regex: ' + err.message });
  }

  runRegexInWorker(pattern, text)
    .then(function (data) {
      res.json(Object.assign({ pattern: pattern, textLength: text.length }, data));
    })
    .catch(function (err) {
      const status = err.message.indexOf('timed out') >= 0 ? 408 : 500;
      res.status(status).json({ error: err.message });
    });
});

app.listen(PORT, function () {
  console.log('DevUtils (protected) running at http://localhost:' + PORT);
});
