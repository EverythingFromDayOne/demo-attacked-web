/*
 * Terminal 2: cd demo-attacked/event-loop-blocking && npm run console
 */

const express = require('express');

const app = express();
const PORT = 3032;
const VICTIM_PORT = 3031;
const PROTECTED_PORT = 3033;

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
      background: #dc2626;
      color: #fff;
      border-color: #dc2626;
    }
    .target-switcher .btn-protected.active {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }`;

function buildConsoleHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Loop Blocking — Attack Console</title>
  <style>
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
      max-width: 720px;
    }
    .flow-box strong { color: #facc15; }
    .credentials-panel {
      background: #111;
      border: 1px solid #1a3a1a;
      border-radius: 8px;
      padding: 1.5rem;
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
    ${SWITCHER_CSS}
  </style>
</head>
<body>
  <h1>Event Loop Blocking — Attack Console</h1>
  <p class="subtitle">One synchronous request can freeze an entire Node.js server</p>

  <div class="flow-box" style="max-width:900px">
    <strong>HOW IT WORKS</strong><br><br>
    1. Node.js processes all requests on a single thread<br>
    2. A synchronous operation (CPU loop, ReDoS regex) runs to completion before<br>
       the event loop can handle anything else<br>
    3. All other incoming requests queue behind it — including health checks<br>
    4. From the outside, the server appears to hang or crash<br>
    5. A single attacker request is a denial-of-service for all other users
  </div>

  <div class="credentials-panel">
    <h2>Live Health Monitor</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Polls <code>/health</code> on both servers every 500ms.
      Fire an attack below and watch the vulnerable server stop responding.
    </p>
    <table>
      <thead>
        <tr>
          <th>Server</th>
          <th>Status</th>
          <th>Last Response Time</th>
          <th>Last 5 pings</th>
        </tr>
      </thead>
      <tbody>
        <tr id="row-vulnerable">
          <td>Vulnerable :${VICTIM_PORT}</td>
          <td id="status-3031">—</td>
          <td id="latency-3031">—</td>
          <td id="history-3031" style="font-size:0.75rem;color:#64748b">—</td>
        </tr>
        <tr id="row-protected">
          <td>Protected :${PROTECTED_PORT}</td>
          <td id="status-3033">—</td>
          <td id="latency-3033">—</td>
          <td id="history-3033" style="font-size:0.75rem;color:#64748b">—</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 1 — CPU Loop</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Sends a compute request with 50,000,000 iterations to the vulnerable server.
      Simultaneously continues polling health on both servers.
    </p>
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
      <label style="font-size:0.82rem;color:#94a3b8">Iterations:</label>
      <input type="number" id="cpu-n" value="50000000" min="1000" step="1000000"
        style="background:#111;border:1px solid #1a3a1a;color:#00ff41;padding:0.4rem 0.6rem;
               border-radius:4px;font-family:inherit;font-size:0.82rem;width:160px">
      <button type="button" id="btn-cpu-attack" class="demo-btn">
        ⚡ Fire CPU Attack → :${VICTIM_PORT}
      </button>
    </div>
    <div id="cpu-result" style="font-size:0.82rem;color:#64748b;min-height:1.5rem"></div>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Attack 2 — ReDoS (Catastrophic Regex Backtracking)</h2>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:1rem;max-width:640px">
      Sends a regex pattern that causes exponential backtracking.
      The regex engine tries every possible combination before giving up.
    </p>
    <div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1rem;max-width:500px">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <label style="font-size:0.82rem;color:#94a3b8;min-width:70px">Pattern:</label>
        <input type="text" id="regex-pattern" value="(a+)+b"
          style="flex:1;background:#111;border:1px solid #1a3a1a;color:#facc15;
                 padding:0.4rem 0.6rem;border-radius:4px;font-family:inherit;font-size:0.82rem">
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <label style="font-size:0.82rem;color:#94a3b8;min-width:70px">Text:</label>
        <input type="text" id="regex-text" value="aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          style="flex:1;background:#111;border:1px solid #1a3a1a;color:#00ff41;
                 padding:0.4rem 0.6rem;border-radius:4px;font-family:inherit;font-size:0.82rem">
      </div>
      <button type="button" id="btn-regex-attack" class="demo-btn" style="align-self:flex-start">
        ⚡ Fire ReDoS Attack → :${VICTIM_PORT}
      </button>
    </div>
    <div id="regex-result" style="font-size:0.82rem;color:#64748b;min-height:1.5rem"></div>
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-switcher-protected">Protected (:${PROTECTED_PORT})</button>
  </div>

  <script>
    var history3031 = [];
    var history3033 = [];

    function ping(port, statusId, latencyId, historyId, historyArr) {
      var start = Date.now();
      fetch('http://localhost:' + port + '/health', { signal: AbortSignal.timeout(6000) })
        .then(function (r) { return r.json(); })
        .then(function () {
          var ms = Date.now() - start;
          historyArr.unshift(ms + 'ms');
          if (historyArr.length > 5) historyArr.pop();
          var color = ms < 100 ? '#00ff41' : ms < 1000 ? '#facc15' : '#ef4444';
          document.getElementById(statusId).innerHTML =
            '<span style="color:' + color + '">● ok</span>';
          document.getElementById(latencyId).innerHTML =
            '<span style="color:' + color + '">' + ms + 'ms</span>';
          document.getElementById(historyId).textContent = historyArr.join(' · ');
        })
        .catch(function () {
          var ms = Date.now() - start;
          historyArr.unshift('TIMEOUT');
          if (historyArr.length > 5) historyArr.pop();
          document.getElementById(statusId).innerHTML =
            '<span style="color:#ef4444">● blocked</span>';
          document.getElementById(latencyId).innerHTML =
            '<span style="color:#ef4444">' + ms + 'ms (queued/timeout)</span>';
          document.getElementById(historyId).textContent = historyArr.join(' · ');
        });
    }

    setInterval(function () {
      ping(${VICTIM_PORT}, 'status-3031', 'latency-3031', 'history-3031', history3031);
      ping(${PROTECTED_PORT}, 'status-3033', 'latency-3033', 'history-3033', history3033);
    }, 500);

    ping(${VICTIM_PORT}, 'status-3031', 'latency-3031', 'history-3031', history3031);
    ping(${PROTECTED_PORT}, 'status-3033', 'latency-3033', 'history-3033', history3033);

    document.getElementById('btn-cpu-attack').addEventListener('click', function () {
      var n = parseInt(document.getElementById('cpu-n').value, 10) || 50000000;
      var result = document.getElementById('cpu-result');
      var start = Date.now();
      result.innerHTML = '<span style="color:#facc15">⏳ Firing... watch :${VICTIM_PORT} health monitor above</span>';
      fetch('http://localhost:${VICTIM_PORT}/api/compute?n=' + n)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ms = Date.now() - start;
          result.innerHTML = '<span style="color:#00ff41">✓ Completed in ' + ms + 'ms — result: ' + data.result.toFixed(4) + '</span>';
        })
        .catch(function (err) {
          result.innerHTML = '<span style="color:#ef4444">✗ ' + err.message + '</span>';
        });
    });

    document.getElementById('btn-regex-attack').addEventListener('click', function () {
      var pattern = document.getElementById('regex-pattern').value;
      var text = document.getElementById('regex-text').value;
      var result = document.getElementById('regex-result');
      var start = Date.now();
      result.innerHTML = '<span style="color:#facc15">⏳ Firing ReDoS... watch :${VICTIM_PORT} health monitor above</span>';
      fetch('http://localhost:${VICTIM_PORT}/api/regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern, text: text })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ms = Date.now() - start;
          result.innerHTML = '<span style="color:#00ff41">✓ Completed in ' + ms + 'ms — match: ' + data.match + '</span>';
        })
        .catch(function (err) {
          result.innerHTML = '<span style="color:#ef4444">✗ ' + err.message + '</span>';
        });
    });

    document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
    });
    document.getElementById('btn-switcher-protected').addEventListener('click', function () {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildConsoleHtml());
});

app.listen(PORT, function () {
  console.log('Event loop blocking attack console running at http://localhost:' + PORT);
});
