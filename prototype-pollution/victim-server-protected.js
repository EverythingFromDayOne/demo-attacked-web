/*
 * Terminal 3: cd demo-attacked/prototype-pollution && npm run secure
 */

const express = require('express');

const app = express();
const PORT = 3030;

function parseJsonBody(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', function (chunk) { data += chunk; });
  req.on('end', function () {
    try {
      req.body = data ? JSON.parse(data) : {};
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON body' });
    }
  });
}

const presets = [
  { id: 1, name: 'ESLint Base', config: { rules: { 'no-console': 'warn' }, env: { node: true } } },
  { id: 2, name: 'Webpack Dev', config: { mode: 'development', devtool: 'source-map' } },
  { id: 3, name: 'TypeScript Strict', config: { strict: true, noImplicitAny: true } },
];

// ✅ PROTECTED — Object.keys() only returns own enumerable keys (not inherited),
// and the blocklist explicitly rejects __proto__, constructor, prototype.
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = Object.create(null);
      }
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sharedCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      color: #334155;
      min-height: 100vh;
      line-height: 1.5;
    }
    a { color: #0ea5e9; text-decoration: none; }
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
    .wordmark span { color: #0ea5e9; }
    .nav-links { display: flex; gap: 1.5rem; }
    .nav-links a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .nav-links a:hover { color: #0ea5e9; }
    .nav-links a.active { color: #0ea5e9; }
    .shell {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.75rem 1.5rem 3rem;
    }
    .proto-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.85rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }
    .proto-status.clean {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }
    .proto-status.polluted {
      background: #450a0a;
      color: #fca5a5;
      border: 1px solid #dc2626;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
    .panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
    }
    .panel h2 {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 1rem;
    }
    .preset-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .preset-card:last-child { margin-bottom: 0; }
    .preset-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    .preset-preview {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.72rem;
      color: #64748b;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 0.5rem;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin-bottom: 0.65rem;
    }
    .btn-use {
      background: #fff;
      color: #0ea5e9;
      border: 1px solid #0ea5e9;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-use:hover { background: #f0f9ff; }
    label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 0.35rem;
    }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 0.65rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.8rem;
      resize: vertical;
      margin-bottom: 0.85rem;
    }
    textarea:focus {
      outline: none;
      border-color: #0ea5e9;
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
    }
    .btn-merge {
      background: #0ea5e9;
      color: #fff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-merge:hover { background: #0284c7; }
    .result-panel {
      margin-top: 1rem;
      padding: 0.85rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.78rem;
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 3rem;
      color: #334155;
    }
    .result-panel.error { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
    .payload-hint {
      margin-top: 1rem;
      font-size: 0.85rem;
    }
    .payload-hint summary {
      cursor: pointer;
      color: #64748b;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .payload-hint pre {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 0.75rem;
      overflow-x: auto;
      margin-top: 0.5rem;
    }
    .payload-note {
      font-size: 0.78rem;
      color: #94a3b8;
      margin-top: 0.5rem;
    }
    .admin-locked {
      max-width: 480px;
      margin: 4rem auto;
      text-align: center;
      padding: 2.5rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    .admin-locked .lock-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .admin-locked p { color: #64748b; font-size: 0.95rem; }
    .admin-alert {
      background: #450a0a;
      border: 2px solid #dc2626;
      color: #fca5a5;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .admin-table th,
    .admin-table td {
      text-align: left;
      padding: 0.65rem 0.85rem;
      border: 1px solid #e2e8f0;
    }
    .admin-table th { background: #f8fafc; color: #475569; }
    .admin-table code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.78rem;
      word-break: break-all;
    }
    .callout {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      font-size: 0.85rem;
      color: #9a3412;
      line-height: 1.6;
    }
  `;
}

function buildTopnav(active) {
  return (
    '<nav class="topnav">' +
      '<div class="wordmark"><span>Config</span>Hub</div>' +
      '<div class="nav-links">' +
        '<a href="/#presets"' + (active === 'presets' ? ' class="active"' : '') + '>Presets</a>' +
        '<span style="color:#cbd5e1">·</span>' +
        '<a href="/#merge"' + (active === 'merge' ? ' class="active"' : '') + '>Merge</a>' +
        '<span style="color:#cbd5e1">·</span>' +
        '<a href="/admin"' + (active === 'admin' ? ' class="active"' : '') + '>Admin</a>' +
      '</div>' +
    '</nav>'
  );
}

function buildPresetCards() {
  return presets.map(function (preset) {
    const preview = JSON.stringify(preset.config);
    return (
      '<div class="preset-card">' +
        '<div class="preset-name">' + escapeHtml(preset.name) + '</div>' +
        '<div class="preset-preview">' + escapeHtml(preview) + '</div>' +
        '<button type="button" class="btn-use" data-id="' + preset.id + '">Use as Base</button>' +
      '</div>'
    );
  }).join('');
}

function buildDashboardHtml() {
  const presetsJson = JSON.stringify(presets);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConfigHub — JSON Config Presets</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner protected">
    ✅ PROTECTED: merge uses Object.keys() + __proto__ blocklist + Object.create(null)
  </div>
  ${buildTopnav('merge')}
  <div class="shell">
    <div id="proto-status" class="proto-status clean">🟢 Object.prototype is clean</div>
    <div class="grid-2">
      <div class="panel" id="presets">
        <h2>Preset Library</h2>
        ${buildPresetCards()}
      </div>
      <div class="panel" id="merge">
        <h2>Merge Workbench</h2>
        <label for="base-config">Base Config (JSON)</label>
        <textarea id="base-config">{}</textarea>
        <label for="patch-config">Patch Config (JSON)</label>
        <textarea id="patch-config">{}</textarea>
        <button type="button" class="btn-merge" id="btn-merge">Merge →</button>
        <div class="result-panel" id="merge-result">Merged output will appear here.</div>
        <details class="payload-hint">
          <summary>▶ Try this payload</summary>
          <pre>{
  "base": {},
  "patch": { "__proto__": { "isAdmin": true, "role": "superadmin" } }
}</pre>
          <p class="payload-note">Paste into Patch Config and click Merge. Then visit /admin — access stays denied.</p>
        </details>
      </div>
    </div>
  </div>
  <script>
    var PRESETS = ${presetsJson};
    document.querySelectorAll('.btn-use').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var preset = PRESETS.find(function (p) { return p.id === id; });
        if (preset) {
          document.getElementById('base-config').value = JSON.stringify(preset.config, null, 2);
        }
      });
    });
    document.getElementById('btn-merge').addEventListener('click', function () {
      var resultEl = document.getElementById('merge-result');
      var baseText = document.getElementById('base-config').value;
      var patchText = document.getElementById('patch-config').value;
      var base, patch;
      try { base = JSON.parse(baseText); } catch (e) {
        resultEl.className = 'result-panel error';
        resultEl.textContent = 'Invalid Base JSON: ' + e.message;
        return;
      }
      try { patch = JSON.parse(patchText); } catch (e) {
        resultEl.className = 'result-panel error';
        resultEl.textContent = 'Invalid Patch JSON: ' + e.message;
        return;
      }
      fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base: base, patch: patch })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            resultEl.className = 'result-panel error';
            resultEl.textContent = data.error;
          } else {
            resultEl.className = 'result-panel';
            resultEl.textContent = JSON.stringify(data.result, null, 2);
          }
        })
        .catch(function (err) {
          resultEl.className = 'result-panel error';
          resultEl.textContent = 'Request failed: ' + err.message;
        });
    });
    function updateProtoStatus() {
      fetch('/api/proto-check')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var el = document.getElementById('proto-status');
          if (data.polluted) {
            el.className = 'proto-status polluted';
            el.textContent = '🔴 Object.prototype POLLUTED — isAdmin: ' + data.isAdmin + ', role: ' + data.role;
          } else {
            el.className = 'proto-status clean';
            el.textContent = '🟢 Object.prototype is clean';
          }
        });
    }
    updateProtoStatus();
    setInterval(updateProtoStatus, 2000);
  </script>
</body>
</html>`;
}

function buildAdminPage(granted) {
  if (!granted) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConfigHub — Admin</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner protected">
    ✅ PROTECTED: merge uses Object.keys() + __proto__ blocklist + Object.create(null)
  </div>
  ${buildTopnav('admin')}
  <div class="shell">
    <div class="admin-locked">
      <div class="lock-icon">🔒</div>
      <p>Admin access denied. You do not have the required privileges.</p>
    </div>
  </div>
</body>
</html>`;
  }

  const presetRows = presets.map(function (p) {
    return (
      '<tr>' +
        '<td>' + escapeHtml(String(p.id)) + '</td>' +
        '<td>' + escapeHtml(p.name) + '</td>' +
        '<td><code>' + escapeHtml(JSON.stringify(p.config)) + '</code></td>' +
      '</tr>'
    );
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConfigHub — Admin</title>
  <style>${sharedCss()}</style>
</head>
<body>
  <div class="demo-banner protected">
    ✅ PROTECTED: merge uses Object.keys() + __proto__ blocklist + Object.create(null)
  </div>
  ${buildTopnav('admin')}
  <div class="shell">
    <div class="admin-alert">🚨 ADMIN ACCESS GRANTED via prototype pollution</div>
    <table class="admin-table">
      <thead><tr><th>ID</th><th>Name</th><th>Config</th></tr></thead>
      <tbody>${presetRows}</tbody>
    </table>
    <table class="admin-table">
      <thead><tr><th>Property</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Object.prototype.isAdmin</td><td>true</td></tr>
        <tr><td>Object.prototype.role</td><td>superadmin</td></tr>
      </tbody>
    </table>
    <div class="callout">
      Every {} in this Node.js process now inherits these properties.
      Restart the server to clear the pollution.
    </div>
  </div>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildDashboardHtml());
});

app.post('/api/merge', parseJsonBody, function (req, res) {
  const base = req.body.base;
  const patch = req.body.patch;

  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return res.status(400).json({ error: 'base must be a plain object' });
  }
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return res.status(400).json({ error: 'patch must be a plain object' });
  }

  const result = safeMerge(base, patch);
  res.json({ result: result });
});

app.get('/admin', function (req, res) {
  const user = {};
  if (user.isAdmin) {
    res.send(buildAdminPage(true));
  } else {
    res.send(buildAdminPage(false));
  }
});

app.get('/api/proto-check', function (req, res) {
  const probe = {};
  res.json({
    isAdmin: probe.isAdmin,
    role: probe.role,
    polluted: probe.isAdmin === true,
  });
});

app.listen(PORT, function () {
  console.log('ConfigHub (protected) running at http://localhost:' + PORT);
});
