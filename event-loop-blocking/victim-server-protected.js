/*
 * Terminal 3: cd demo-attacked/event-loop-blocking && npm run secure
 */

const express = require('express');
const path = require('path');
const { Worker } = require('worker_threads');

const app = express();
const PORT = 3033;
const WORKER_PATH = path.join(__dirname, 'worker.js');

const LOREM_IPSUM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ' +
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ' +
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. ' +
  'Curabitur pretium tincidunt lacus. Nulla facilisi. Ut convallis, sem sit amet interdum consectetuer, odio augue aliquam elit, ' +
  'nec pulvinar tortor odio sollicitudin quam. Etiam iaculis lorem quis nibh. Aliquam erat volutpat. Duis ac turpis. ' +
  'Integer rutrum ante eu lacus. Vestibulum libero nisl, porta vel, scelerisque eget, malesuada at, neque. ' +
  'Vivamus eget nibh. Etiam cursus leo vel metus. Nulla facilisi. Aenean nec eros. Vestibulum ante ipsum primis in faucibus orci luctus ' +
  'et ultrices posuere cubilia Curae; Suspendisse sollicitudin velit sed leo. Ut pharetra augue nec augue. Nam elit magna, hendrerit sit amet, ' +
  'tincidunt ac, viverra sed, nulla. Donec porta diam eu massa. Quisque diam lorem, interdum vitae, dapibus ac, scelerisque vitae, pede. ' +
  'Donec eget tellus non erat lacinia fermentum. Donec in velit vel ipsum auctor pulvinar. Proin ullamcorper urna et felis. ' +
  'Vestibulum iaculis lacinia est. Proin dictum elementum velit. Fusce euismod consequat ante. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. ' +
  'Pellentesque sed dolor. Aliquam congue fermentum nisl. Mauris accumsan nulla vel diam. Sed in lacus ut enim adipiscing aliquet. ' +
  'Nulla venenatis. In pede mi, aliquet sit amet, euismod in, auctor ut, ligula. Aliquam dapibus tincidunt metus. Praesent justo dolor, lobortis quis, ' +
  'lobortis dignissim, pulvinar ac, lorem. Integer lacinia. Suspendisse potenti. Sed egestas, ante et vulputate viverra, turpis nisi sollicitudin lorem, ' +
  'in finibus nulla eros id dolor. Nam ac ligula dolor. Integer at 42 and 12345 appear throughout this corpus for regex testing purposes.';

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      line-height: 1.5;
    }
    a { color: #7c3aed; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .demo-banner {
      padding: 0.65rem 1.5rem;
      font-size: 0.82rem;
      text-align: center;
      font-weight: 500;
    }
    .demo-banner.protected {
      background: #dcfce7;
      border-bottom: 2px solid #16a34a;
      color: #166534;
    }
    .topnav {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.5rem;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .wordmark {
      font-weight: 700;
      font-size: 1.15rem;
      color: #0f172a;
    }
    .wordmark span { color: #7c3aed; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .nav-links a:hover { color: #7c3aed; }
    .nav-links a.active { color: #7c3aed; }
    .shell {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.75rem 1.5rem 3rem;
    }
    .panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }
    .panel h2 {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.35rem;
    }
    input[type="number"], input[type="text"] {
      width: 100%;
      max-width: 280px;
      padding: 0.6rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.9rem;
      font-family: inherit;
      margin-bottom: 0.85rem;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 0.65rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.85rem;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 0.85rem;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
    }
    .btn-run {
      background: #7c3aed;
      color: #fff;
      border: none;
      padding: 0.6rem 1.1rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-run:hover { background: #6d28d9; }
    .result-box {
      margin-top: 0.85rem;
      padding: 0.75rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      color: #475569;
      min-height: 2.5rem;
    }
    .result-box.error { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
    .hint details { margin-top: 0.85rem; font-size: 0.82rem; color: #64748b; }
    .hint summary { cursor: pointer; font-weight: 500; }
    .hint pre {
      margin-top: 0.5rem;
      padding: 0.65rem;
      background: #f1f5f9;
      border-radius: 6px;
      font-size: 0.75rem;
      overflow-x: auto;
    }
    .health-history {
      margin-top: 0.5rem;
      font-size: 0.78rem;
      color: #94a3b8;
    }
    .health-history span { margin-right: 0.5rem; }
    .health-ok { color: #16a34a; }
    .health-slow { color: #ca8a04; }
    .health-bad { color: #dc2626; }
  `;
}

function buildTopnav(active) {
  return (
    '<nav class="topnav">' +
      '<div class="wordmark"><span>Dev</span>Utils</div>' +
      '<div class="nav-links">' +
        '<a href="/#compute"' + (active === 'compute' ? ' class="active"' : '') + '>Compute</a>' +
        '<span style="color:#cbd5e1">·</span>' +
        '<a href="/#regex"' + (active === 'regex' ? ' class="active"' : '') + '>Regex</a>' +
        '<span style="color:#cbd5e1">·</span>' +
        '<a href="/#health"' + (active === 'health' ? ' class="active"' : '') + '>Health</a>' +
      '</div>' +
    '</nav>'
  );
}

function buildDashboardHtml() {
  const loremEscaped = escapeHtml(LOREM_IPSUM);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevUtils — Developer Utilities</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner protected">
    ✅ PROTECTED: CPU work runs in worker threads — event loop stays free
  </div>
  ${buildTopnav('compute')}
  <div class="shell">
    <div class="panel" id="compute">
      <h2>Compute</h2>
      <label for="iterations">Iterations</label>
      <input type="number" id="iterations" value="1000" min="1" step="1000">
      <button type="button" class="btn-run" id="btn-compute">Run</button>
      <div class="result-box" id="compute-result">Result will appear here.</div>
      <div class="hint">
        <details>
          <summary>▶ Timing hints</summary>
          <pre>Normal:  ?n=1000000    (~50ms, worker thread)
Attack:  ?n=50000000   (worker runs ~5s — /health still responds instantly)</pre>
        </details>
      </div>
    </div>

    <div class="panel" id="regex">
      <h2>Regex Search</h2>
      <label for="pattern">Pattern</label>
      <input type="text" id="pattern" value="\\d+">
      <label for="search-text">Text to search</label>
      <textarea id="search-text">${loremEscaped}</textarea>
      <button type="button" class="btn-run" id="btn-regex">Test</button>
      <div class="result-box" id="regex-result">Match result will appear here.</div>
      <div class="hint">
        <details>
          <summary>▶ Pattern hints</summary>
          <pre>Normal:  pattern=\\d+   text=hello world
Attack:  pattern=(a+)+b   text=aaaaaaaaaaaaaaaaaaaaaaaaaaaa (408 after 5s timeout)</pre>
        </details>
      </div>
    </div>

    <div class="panel" id="health">
      <h2>Health</h2>
      <button type="button" class="btn-run" id="btn-health">Ping</button>
      <div class="result-box" id="health-result">Last ping: —</div>
      <div class="health-history" id="health-history"></div>
    </div>
  </div>
  <script>
    var healthHistory = [];

    document.getElementById('btn-compute').addEventListener('click', function () {
      var n = parseInt(document.getElementById('iterations').value, 10) || 1000;
      var el = document.getElementById('compute-result');
      el.className = 'result-box';
      el.textContent = 'Running in worker thread...';
      var start = Date.now();
      fetch('/api/compute?n=' + n)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          var ms = Date.now() - start;
          el.textContent = 'Result: ' + data.result.toFixed(4) + ' | Iterations: ' + data.iterations + ' | Time: ' + ms + 'ms';
        })
        .catch(function (err) {
          el.className = 'result-box error';
          el.textContent = 'Error: ' + err.message;
        });
    });

    document.getElementById('btn-regex').addEventListener('click', function () {
      var pattern = document.getElementById('pattern').value;
      var text = document.getElementById('search-text').value;
      var el = document.getElementById('regex-result');
      el.className = 'result-box';
      el.textContent = 'Testing in worker thread...';
      var start = Date.now();
      fetch('/api/regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern, text: text })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          var ms = Date.now() - start;
          if (!res.ok) throw new Error(res.data.error || 'Request failed');
          el.textContent = 'Match: ' + res.data.match + ' | Pattern: ' + pattern + ' | Text length: ' + text.length + ' | Time: ' + ms + 'ms';
        })
        .catch(function (err) {
          el.className = 'result-box error';
          el.textContent = 'Error: ' + err.message;
        });
    });

    function pingHealth() {
      var el = document.getElementById('health-result');
      var histEl = document.getElementById('health-history');
      var start = Date.now();
      fetch('/health', { signal: AbortSignal.timeout(8000) })
        .then(function (r) { return r.json(); })
        .then(function () {
          var ms = Date.now() - start;
          healthHistory.unshift(ms);
          if (healthHistory.length > 5) healthHistory.pop();
          el.textContent = 'Last ping: ' + ms + 'ms — status ok';
          histEl.innerHTML = healthHistory.map(function (m) {
            var cls = m < 100 ? 'health-ok' : m < 1000 ? 'health-slow' : 'health-bad';
            return '<span class="' + cls + '">' + m + 'ms</span>';
          }).join('');
        })
        .catch(function () {
          var ms = Date.now() - start;
          healthHistory.unshift('TIMEOUT');
          if (healthHistory.length > 5) healthHistory.pop();
          el.textContent = 'Last ping: blocked or timed out (' + ms + 'ms)';
          histEl.innerHTML = healthHistory.map(function (m) {
            return '<span class="health-bad">' + m + '</span>';
          }).join('');
        });
    }

    document.getElementById('btn-health').addEventListener('click', pingHealth);
    pingHealth();
    setInterval(pingHealth, 3000);
  </script>
</body>
</html>`;
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

app.get('/', function (req, res) {
  res.send(buildDashboardHtml());
});

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
