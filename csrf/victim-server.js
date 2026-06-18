/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/csrf && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/csrf && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3010  ← Log in as john.doe / password123
 * 2. http://localhost:3011  ← Open lure page
 * 3. Return to NetBank — balance drained by forged transfer
 */

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = 3010;

app.use('/api/account', cors({ origin: 'http://localhost:3011', credentials: true }));

const SESSION_VALUE = 'NetBankJohn_csrf_demo_TOKEN';
const VALID_USER = { username: 'john.doe', password: 'password123' };

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
  res.json({ mode: 'vulnerable', port: PORT });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === VALID_USER.username && password === VALID_USER.password) {
    // HttpOnly=true — intentional: demonstrates HttpOnly is irrelevant to CSRF
    // No sameSite attribute — browser sends cookie on cross-port form POSTs from localhost:3011
    res.cookie('nb_session', SESSION_VALUE, { httpOnly: true, path: '/' });
    return res.json({ success: true });
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
  });
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('nb_session', { path: '/' });
  res.json({ success: true });
});

// ⚠️ VULNERABLE — no CSRF token validation. Any site can forge this POST if the
//    victim's browser holds a valid nb_session cookie. HttpOnly does not help —
//    the browser attaches cookies automatically; no JavaScript required.
app.post('/transfer', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const { recipient, account, amount } = req.body;
  const result = processTransfer(recipient, account, amount);

  if (result.error) {
    return res.status(400).json(result);
  }

  res.json(result);
});

// ⚠️ VULNERABLE — GET endpoint that mutates state. CSRF via <img src="..."> fires
//    with zero JavaScript and zero user clicks. GET requests must never change state.
app.get('/transfer-get', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).send('Unauthorized');
  }

  const { recipient, account, amount } = req.query;
  const result = processTransfer(recipient, account, amount);

  if (result.error) {
    return res.status(400).send(result.error);
  }

  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`NetBank victim server (VULNERABLE) running at http://localhost:${PORT}`);
  console.log(`Login: john.doe / password123`);
});
