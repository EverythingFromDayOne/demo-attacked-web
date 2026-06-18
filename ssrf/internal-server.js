/*
 * How to Run:
 *
 * Terminal 2: cd demo-attacked/ssrf && npm run internal
 *
 * Internal services registry:
 * http://localhost:3020  ← private microservice (SSRF target in the demo)
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3020;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'internal.html'));
});

app.listen(PORT, function () {
  console.log('Internal services registry running at http://localhost:' + PORT);
});
