/*
 * How to Run:
 *
 * Terminal 2: cd demo-attacked/ssrf && npm run guide
 *
 * Internal services registry:
 * http://localhost:3020  ← private microservice (SSRF target in the demo)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3020;
const VICTIM_PORT = 3019;
const PROTECTED_PORT = 3021;

app.use(cors());
app.use(express.json());

const INTERNAL_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://admin:Sup3rS3cr3tPwd!@db.internal:5432/devshare_prod',
  REDIS_URL: 'redis://:RedisPass2024@cache.internal:6379/0',
  JWT_SECRET: 'f9a3b2c1d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  STRIPE_SECRET_KEY: 'sk_test_EXAMPLE_REPLACE_FOR_REAL_DEMO',
  SENDGRID_API_KEY: 'SG.FakeKeyDemo.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  ADMIN_PASSWORD: 'DevShareAdmin2024!',
  ENCRYPTION_KEY: 'aes-256-cbc:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
};

const INTERNAL_USERS = {
  total: 3,
  users: [
    {
      id: 1,
      email: 'admin@devshare.io',
      role: 'superadmin',
      password_hash: '$2b$10$FakeHashAdminXXXXXXXXXXXXXXXXXXXXXXXXXX',
      created_at: '2024-01-15T09:00:00Z',
    },
    {
      id: 2,
      email: 'sarah.chen@devshare.io',
      role: 'admin',
      password_hash: '$2b$10$FakeHashSarahXXXXXXXXXXXXXXXXXXXXXXXXX',
      created_at: '2024-03-22T14:30:00Z',
    },
    {
      id: 3,
      email: 'dev-bot@devshare.io',
      role: 'service_account',
      api_key: 'ds_live_serviceaccount_k8s_FAKEKEY12345',
      created_at: '2024-06-01T08:00:00Z',
    },
  ],
};

const INTERNAL_CONFIG = {
  database: {
    primary: 'db-primary.internal:5432',
    replica: 'db-replica.internal:5432',
    pool_size: 20,
  },
  cache: { host: 'cache.internal', port: 6379, ttl: 3600 },
  storage: { bucket: 'devshare-prod-assets', region: 'us-east-1' },
  feature_flags: { admin_panel: true, beta_export: false },
  rate_limits: { public_api: 100, internal_api: 10000 },
};

const INTERNAL_HEALTH = {
  status: 'healthy',
  uptime_seconds: 1209600,
  db_connection: 'postgresql://admin:Sup3rS3cr3tPwd!@db.internal:5432/devshare_prod',
  redis_connection: 'redis://:RedisPass2024@cache.internal:6379/0',
  checks: { database: 'ok', cache: 'ok', storage: 'ok' },
};

function jsonRoute(res, payload) {
  res.set('Content-Type', 'application/json');
  res.json(payload);
}

app.get('/internal', function (req, res) {
  jsonRoute(res, {
    service: 'internal-admin-api',
    version: '2.1.4',
    environment: 'production',
    note: 'THIS SERVICE SHOULD NOT BE PUBLICLY ACCESSIBLE',
    endpoints: [
      '/internal/env',
      '/internal/users',
      '/internal/config',
      '/internal/health',
    ],
  });
});

app.get('/internal/env', function (req, res) {
  jsonRoute(res, INTERNAL_ENV);
});

app.get('/internal/users', function (req, res) {
  jsonRoute(res, INTERNAL_USERS);
});

app.get('/internal/config', function (req, res) {
  jsonRoute(res, INTERNAL_CONFIG);
});

app.get('/internal/health', function (req, res) {
  jsonRoute(res, INTERNAL_HEALTH);
});

const ENDPOINTS = [
  { path: '/internal', description: 'Service discovery', response: 'JSON' },
  { path: '/internal/env', description: 'Runtime environment & secrets', response: 'JSON' },
  { path: '/internal/users', description: 'User database snapshot', response: 'JSON' },
  { path: '/internal/config', description: 'Infrastructure configuration', response: 'JSON' },
  { path: '/internal/health', description: 'DB / Redis connection strings', response: 'JSON' },
];

function buildRootPageHtml() {
  const rows = ENDPOINTS.map(function (endpoint, index) {
    const rowClass = index % 2 === 0 ? 'even' : 'odd';
    return (
      '<tr class="' + rowClass + '">' +
        '<td><code>' + endpoint.path + '</code></td>' +
        '<td>' + endpoint.description + '</td>' +
        '<td>' + endpoint.response + '</td>' +
      '</tr>'
    );
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevShare Platform — Internal Services</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
      background: #1a1a2e;
      color: #e2e8f0;
      min-height: 100vh;
      line-height: 1.6;
      font-size: 0.875rem;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 2rem 1.5rem 3rem;
    }
    .header-title {
      font-size: 1rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 0.35rem;
    }
    .header-meta {
      font-size: 0.75rem;
      color: #64748b;
      letter-spacing: 0.02em;
    }
    .warn-line {
      margin: 1.5rem 0 2rem;
      color: #fbbf24;
      font-size: 0.8rem;
      line-height: 1.55;
    }
    .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.75rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #334155;
      font-size: 0.8rem;
    }
    th {
      text-align: left;
      padding: 0.55rem 0.75rem;
      background: #16213e;
      color: #94a3b8;
      font-weight: 600;
      border-bottom: 1px solid #334155;
    }
    td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #334155;
      vertical-align: top;
    }
    tr.even td { background: #1a1a2e; }
    tr.odd td { background: #162032; }
    tr:last-child td { border-bottom: none; }
    td code {
      color: #cbd5e1;
      font-size: 0.78rem;
    }
    .table-note {
      margin-top: 0.75rem;
      font-size: 0.72rem;
      color: #64748b;
      line-height: 1.55;
    }
    details {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #94a3b8;
    }
    details summary {
      cursor: pointer;
      color: #64748b;
      user-select: none;
      list-style: none;
    }
    details summary::-webkit-details-marker { display: none; }
    details[open] summary { margin-bottom: 0.75rem; }
    .demo-body {
      color: #94a3b8;
      line-height: 1.65;
      font-size: 0.78rem;
    }
    .demo-body p { margin-bottom: 0.75rem; }
    .demo-body ol {
      margin: 0.75rem 0 0 1.25rem;
    }
    .demo-body li { margin-bottom: 0.35rem; }
    .demo-body code {
      color: #cbd5e1;
      font-size: 0.76rem;
    }
    hr {
      border: none;
      border-top: 1px solid #334155;
      margin: 2.5rem 0 1.25rem;
    }
    .demo-controls-label {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.65rem;
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
    <div class="header">
      <div class="header-title">DevShare Platform — Internal Services</div>
      <div class="header-meta">devshare-internal.corp  ·  NOT FOR PUBLIC ACCESS</div>
    </div>

    <p class="warn-line">
      ⚠  This service has no authentication — it assumes network-level isolation.<br>
      &nbsp;&nbsp;&nbsp;Access from outside the internal network means your perimeter is broken.
    </p>

    <div class="section-title">Internal Endpoints</div>
    <table>
      <thead>
        <tr>
          <th>Path</th>
          <th>Description</th>
          <th>Response</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="table-note">
      These endpoints return live data. No auth required — access control is<br>
      handled at the network layer (VPC security groups / firewall rules).
    </p>

    <details>
      <summary>▶ Demo context — why this page is reachable</summary>
      <div class="demo-body">
        <p>
          In production, port 3020 would be on a private subnet unreachable from
          your browser. This demo runs everything on localhost so you can see the
          internal API directly — but that's not how SSRF works in the real attack.
        </p>
        <p>In the real attack:</p>
        <p>
          Your browser cannot reach <code>http://localhost:3020/internal/env</code><br>
          DevShare's server (port 3019) CAN reach it — same machine, same network<br>
          You trick DevShare into fetching it for you via the URL preview feature<br>
          DevShare returns the response to your browser
        </p>
        <p>That's Server-Side Request Forgery: you forged a request the server made.</p>
        <p>To run the attack:</p>
        <ol>
          <li>Open <code>http://localhost:${VICTIM_PORT}</code> (vulnerable DevShare)</li>
          <li>Paste any <code>/internal/*</code> URL into the preview field</li>
          <li>Click Generate Preview</li>
          <li>Read the secrets in the preview card</li>
        </ol>
      </div>
    </details>

    <hr>

    <div class="demo-controls-label">Demo Controls</div>
    <div class="demo-controls">
      <button type="button" id="btn-vulnerable">Vulnerable DevShare :${VICTIM_PORT}</button>
      <button type="button" id="btn-protected">Protected DevShare :${PROTECTED_PORT}</button>
    </div>
  </div>

  <script>
    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
    });
    document.getElementById('btn-protected').addEventListener('click', function () {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
    });
  </script>
</body>
</html>`;
}

app.get('/', function (req, res) {
  res.send(buildRootPageHtml());
});

app.listen(PORT, function () {
  console.log('Internal services registry running at http://localhost:' + PORT);
});
