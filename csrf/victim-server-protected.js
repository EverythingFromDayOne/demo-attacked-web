/*
 * How to Run (protected):
 *
 * Terminal 1: cd demo-attacked/csrf && npm run secure
 * Terminal 2: cd demo-attacked/csrf && npm run guide
 *
 * Compare:
 *   http://localhost:3010  ← vulnerable
 *   http://localhost:3012  ← protected (CSRF token + SameSite=Strict)
 */

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = 3012;

app.use('/api/account', cors({ origin: 'http://localhost:3011', credentials: true }));

const SESSION_VALUE = 'NetBankJohn_csrf_demo_TOKEN';
const VALID_USER = { username: 'john.doe', password: 'password123' };

const csrfTokens = new Map();

const accountState = {
  balance: 50000,
  transactions: [
    { type: 'credit', description: 'Payroll deposit', amount: 3200, daysAgo: 3 },
    { type: 'debit', description: 'Electricity bill', amount: 142.5, daysAgo: 5 },
    { type: 'debit', description: 'Netflix annual plan', amount: 89.99, daysAgo: 8 },
    { type: 'credit', description: 'Freelance invoice #221', amount: 500, daysAgo: 12 },
  ],
};

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function isAuthenticated(req) {
  return req.cookies.nb_session === SESSION_VALUE;
}

function processTransfer(recipient, account, amount) {
  const parsed = parseFloat(amount);

  if (!recipient || !account || isNaN(parsed) || parsed <= 0) {
    return { error: 'Invalid transfer details.' };
  }

  if (parsed > accountState.balance) {
    return { error: 'Insufficient funds.' };
  }

  accountState.balance = Math.round((accountState.balance - parsed) * 100) / 100;

  const transaction = {
    type: 'debit',
    description: 'Wire transfer to ' + recipient + ' (' + account + ')',
    amount: parsed,
    timestamp: new Date().toISOString(),
    daysAgo: 0,
  };

  accountState.transactions.unshift(transaction);
  return { success: true, newBalance: accountState.balance, transaction };
}

app.get('/api/config', (req, res) => {
  res.json({ mode: 'protected', port: PORT });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === VALID_USER.username && password === VALID_USER.password) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(SESSION_VALUE, csrfToken);

    // ✅ PROTECTED: SameSite=Strict — browser will not attach this cookie to any
    //    cross-site request, regardless of form method.
    //    Note: on localhost, all ports share the same "site", so this only
    //    demonstrates real protection on separate domains (e.g., evil.com → bank.com).
    //    In production this is the simplest and most effective CSRF defence.
    res.cookie('nb_session', SESSION_VALUE, {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
    });

    return res.json({ success: true, csrfToken });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/account', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  res.json({
    balance: accountState.balance,
    transactions: accountState.transactions,
    owner: 'John Doe',
    accountNo: '••••4821',
    csrfToken: csrfTokens.get(SESSION_VALUE) || '',
  });
});

app.get('/api/logout', (req, res) => {
  csrfTokens.delete(SESSION_VALUE);
  res.clearCookie('nb_session', { path: '/', sameSite: 'strict' });
  res.json({ success: true });
});

app.post('/transfer', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const submitted = req.body._csrf;
  const stored = csrfTokens.get(SESSION_VALUE);

  // ✅ PROTECTED: The attacker's forged form has no _csrf field.
  //    The browser's Same-Origin Policy prevents the attacker's page from
  //    reading the real token out of the victim's HTML — it can submit a
  //    form, but it cannot read the page to learn what token to include.
  //    Without the correct token, the server rejects the request.
  if (!submitted || !stored || submitted !== stored) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }

  const { recipient, account, amount } = req.body;
  const result = processTransfer(recipient, account, amount);

  if (result.error) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// ✅ PROTECTED: GET must not mutate state — state-changing GET CSRF is disabled
app.get('/transfer-get', (req, res) => {
  res.status(405).json({ error: 'Method not allowed. GET transfers are disabled.' });
});

app.listen(PORT, () => {
  console.log(`NetBank PROTECTED server running at http://localhost:${PORT}`);
  console.log(`Login: john.doe / password123`);
  console.log(`Compare vulnerable server at http://localhost:3010`);
});
