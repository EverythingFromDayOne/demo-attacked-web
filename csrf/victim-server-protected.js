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

function buildSpaHtml(csrfToken) {
  const tokenField = csrfToken
    ? '<input type="hidden" name="_csrf" id="csrf-field" value="' + csrfToken + '">'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NetBank — Online Banking [Protected]</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      line-height: 1.5;
      min-height: 100vh;
    }
    .demo-banner {
      background: #dcfce7;
      border-bottom: 2px solid #16a34a;
      color: #166534;
      padding: 0.6rem 1.5rem;
      font-size: 0.85rem;
      text-align: center;
      font-weight: 500;
    }
    header {
      background: #0f172a;
      color: #fff;
      padding: 0 2rem;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo { font-size: 1.35rem; font-weight: 700; }
    .header-right { font-size: 0.9rem; color: #94a3b8; }
    .btn-logout {
      background: transparent;
      border: 1px solid #475569;
      color: #e2e8f0;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      margin-left: 1rem;
    }
    main { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }
    .card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 2rem;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.15rem; margin-bottom: 1.25rem; }
    .hidden { display: none !important; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 0.35rem; }
    input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .btn-primary, .btn-transfer {
      background: #16a34a;
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
    .btn-transfer { background: #0f172a; margin-top: 0.5rem; }
    .login-error { color: #dc2626; font-size: 0.85rem; margin-bottom: 1rem; display: none; }
    .login-error.visible { display: block; }
    .balance-amount { font-size: 2.75rem; font-weight: 700; color: #16a34a; margin: 0.5rem 0; }
    .balance-label { color: #64748b; font-size: 0.85rem; }
    .account-meta { color: #475569; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .txn-list { list-style: none; }
    .txn-list li {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.9rem;
    }
    .txn-credit { color: #16a34a; font-weight: 600; }
    .txn-debit { color: #dc2626; font-weight: 600; }
    .transfer-msg { font-size: 0.85rem; margin-top: 0.75rem; display: none; }
    .transfer-msg.visible { display: block; }
    .transfer-msg.error { color: #dc2626; }
    .transfer-msg.success { color: #16a34a; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .info-panel {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.85rem;
      color: #166534;
      margin-top: 1rem;
      line-height: 1.6;
    }
    @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="demo-banner">
    ✅ PROTECTED: CSRF token required on all transfer requests
  </div>

  <header>
    <div class="logo">NetBank 🏦</div>
    <div class="header-right hidden" id="header-user">
      <span>John Doe</span>
      <button class="btn-logout" id="btn-logout" type="button">Sign Out</button>
    </div>
  </header>

  <main>
    <section id="login-page">
      <div class="card" style="max-width:400px;margin:2rem auto;">
        <h2>Sign in to NetBank</h2>
        <p id="login-error" class="login-error">Invalid credentials.</p>
        <form id="login-form">
          <label for="username">Username</label>
          <input type="text" id="username" required placeholder="john.doe">
          <label for="password">Password</label>
          <input type="password" id="password" required>
          <button class="btn-primary" type="submit">Sign In</button>
        </form>
      </div>
    </section>

    <section id="dashboard-page" class="hidden">
      <div class="grid-2">
        <div class="card">
          <h2>Account Summary</h2>
          <p class="account-meta">John Doe</p>
          <p class="account-meta">Checking ••••4821</p>
          <div class="balance-amount" id="balance-display">$50,000.00</div>
          <p class="balance-label">Available balance</p>
        </div>

        <div class="card">
          <h2>Wire Transfer</h2>
          <form id="transfer-form">
            ${tokenField}
            <label for="recipient">Recipient Name</label>
            <input type="text" id="recipient" name="recipient" required>
            <label for="account">Recipient Account No.</label>
            <input type="text" id="account" name="account" required>
            <label for="amount">Amount USD</label>
            <input type="number" id="amount" name="amount" min="1" step="0.01" required>
            <button class="btn-transfer" type="submit">Transfer Now</button>
          </form>
          <p id="transfer-msg" class="transfer-msg"></p>
          <div class="info-panel">
            <strong>Protections active:</strong><br>
            • Every form contains a one-time CSRF token the server validates<br>
            • Session cookie is SameSite=Strict — browser rejects cross-site submissions
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Recent Transactions</h2>
        <ul class="txn-list" id="txn-list"></ul>
      </div>
    </section>
  </main>

  <script>
    function formatMoney(n) {
      return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function showLogin() {
      document.getElementById('login-page').classList.remove('hidden');
      document.getElementById('dashboard-page').classList.add('hidden');
      document.getElementById('header-user').classList.add('hidden');
    }

    function showDashboard() {
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('dashboard-page').classList.remove('hidden');
      document.getElementById('header-user').classList.remove('hidden');
    }

    function renderTransactions(transactions) {
      var list = document.getElementById('txn-list');
      list.textContent = '';
      transactions.forEach(function (txn) {
        var li = document.createElement('li');
        var left = document.createElement('span');
        left.textContent = txn.description;
        var right = document.createElement('span');
        right.textContent = (txn.type === 'credit' ? '+' : '-') + formatMoney(txn.amount);
        right.className = txn.type === 'credit' ? 'txn-credit' : 'txn-debit';
        li.appendChild(left);
        li.appendChild(right);
        list.appendChild(li);
      });
    }

    async function loadAccount() {
      var res = await fetch('/api/account');
      if (res.status === 401) { showLogin(); return; }
      var data = await res.json();
      document.getElementById('balance-display').textContent = formatMoney(data.balance);
      if (data.csrfToken) {
        var field = document.getElementById('csrf-field');
        if (field) field.value = data.csrfToken;
      }
      renderTransactions(data.transactions);
      showDashboard();
    }

    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('username').value,
          password: document.getElementById('password').value
        })
      });
      var data = await res.json();
      if (data.success) {
        if (data.csrfToken) {
          var field = document.getElementById('csrf-field');
          if (field) field.value = data.csrfToken;
        }
        loadAccount();
      } else {
        document.getElementById('login-error').classList.add('visible');
      }
    });

    document.getElementById('transfer-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var msg = document.getElementById('transfer-msg');
      msg.classList.remove('visible', 'error', 'success');
      var fd = new FormData(e.target);
      var res = await fetch('/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fd)
      });
      var data = await res.json();
      if (data.success) {
        msg.textContent = 'Transfer sent successfully.';
        msg.classList.add('visible', 'success');
        e.target.reset();
        loadAccount();
      } else {
        msg.textContent = data.error || 'Transfer failed.';
        msg.classList.add('visible', 'error');
      }
    });

    document.getElementById('btn-logout').addEventListener('click', async function () {
      await fetch('/api/logout');
      showLogin();
    });

    loadAccount();
  </script>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const token = isAuthenticated(req) ? csrfTokens.get(SESSION_VALUE) || '' : '';
  res.send(buildSpaHtml(token));
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
