# Cursor Prompt: CSRF Attack Demo — NetBank Wire Transfer

## Context

This is part of a security attack demonstration lab under `demo-attacked/`.
XSS demos already exist under `demo-attacked/xss/` (ports 3001–3009).
This CSRF demo lives under `demo-attacked/csrf/` (ports 3010–3012).

Tech stack: Node.js + Express only. No frontend framework. All HTML served as
template literals from the server, same pattern as the XSS demos. Vanilla
CSS and vanilla JS only.

---

## Files to create

```
demo-attacked/csrf/
├── victim-server.js            # NetBank vulnerable — port 3010
├── victim-server-protected.js  # NetBank protected  — port 3012
├── attacker-server.js          # Attacker lure + dashboard — port 3011
├── package.json
└── README.md
```

No separate HTML files — all HTML is inlined in the server as template
literals, exactly like the XSS demos.

---

## Package.json scripts

```
victim            → node victim-server.js
attacker          → node attacker-server.js
victim-protected  → node victim-server-protected.js
```

Dependencies: `express`, `cors`, `cookie-parser`.

---

## NetBank App (victim-server.js — port 3010)

### Visual design

Realistic banking UI. Color scheme: deep navy (`#0f172a`) header, white card
panels, green accent (`#16a34a`) for positive balances, red (`#dc2626`) for
debits. Logo: "NetBank 🏦". Two-page SPA driven by vanilla JS (login page →
dashboard page, no route change — just show/hide divs).

A red demo banner at the very top reads:
`⚠️ VULNERABLE: No CSRF token — any cross-origin form can trigger a transfer`

### Login page

- Username and password fields
- Hardcoded valid credentials: `john.doe` / `password123`
- "Sign In" button — POSTs credentials to `/api/login`
- On success: store session, show dashboard

### Session cookie

Set on successful login via `res.cookie`:

```
name:     nb_session
value:    NetBankJohn_csrf_demo_TOKEN
httpOnly: true    ← INTENTIONAL — demonstrates HttpOnly is irrelevant to CSRF
path:     /
```

No `sameSite` attribute set (omit it entirely — browser defaults to Lax, but
localhost-to-localhost requests are treated as same-site so the cookie IS sent
on cross-port form POSTs, which is exactly what makes the attack work here).

### Dashboard page

Shown after login. Contains:

**Account summary panel:**
- Name: John Doe
- Account: Checking ••••4821
- Balance: starts at `$50,000.00`, displayed large and prominent
- "Available balance" sub-label

**Recent transactions list (pre-seeded, static):**
- +$3,200.00 — Payroll deposit (3 days ago)
- -$142.50 — Electricity bill (5 days ago)
- -$89.99 — Netflix annual plan (8 days ago)
- +$500.00 — Freelance invoice #221 (12 days ago)

New transfers (from CSRF attack or manual use) prepend to this list at runtime.

**Wire Transfer form:**
- Recipient Name (text input, name="recipient")
- Recipient Account No. (text input, name="account")
- Amount USD (number input, name="amount", min=1)
- "Transfer Now" button — submits to `POST /transfer` with
  `application/x-www-form-urlencoded` body (standard HTML form encoding, not JSON)
- ⚠️ Comment in code: `// ⚠️ VULNERABILITY: no CSRF token validation`

### Backend endpoints (victim-server.js)

**POST /api/login**
- Validates username/password against hardcoded values
- Sets nb_session cookie on success
- Returns `{ success: true }` or `{ error: 'Invalid credentials' }`

**POST /transfer**  ← the vulnerable endpoint
- Requires session cookie (returns 401 if missing)
- Reads `recipient`, `account`, `amount` from `req.body`
- ⚠️ NO CSRF token check — processes immediately
- Deducts amount from in-memory balance (floor at 0, return error if
  insufficient funds)
- Prepends to in-memory transaction history:
  `{ type: 'debit', description: 'Wire transfer to ' + recipient, amount, timestamp }`
- Returns `{ success: true, newBalance, transaction }`

**GET /api/account**
- Requires session cookie (401 if missing)
- Returns `{ balance, transactions, owner: 'John Doe', accountNo: '••••4821' }`

**GET /api/logout**
- Clears the cookie, returns `{ success: true }`

**GET /** — serves the entire SPA HTML (login + dashboard in one page,
toggled by JS)

---

## Attacker Server (attacker-server.js — port 3011)

Two pages served:

### GET / — Attacker dashboard

Explain the attack to the demo viewer. Dark hacker aesthetic (dark background,
green terminal-style font). Shows:

- Title: "CSRF Attack Lab — NetBank"
- Attack flow diagram as a numbered list in a styled box:
  1. Victim logs into NetBank at localhost:3010
  2. Victim visits the lure page (link provided below)
  3. Lure page silently submits a hidden form to localhost:3010/transfer
  4. Browser auto-attaches nb_session cookie — NetBank processes the transfer
  5. Victim checks their balance — $9,000 is gone
- Prominent link/button: "Open Lure Page →" pointing to `/lure`
- Note: "HttpOnly=true on nb_session — yet the attack still works. CSRF does
  not need JS to read the cookie. The browser sends it automatically."

### GET /lure — The malicious page

Disguised as a "ShopNest Rewards" notification:
- Branding: "ShopNest 🛒" (reuse the brand from the Reflected XSS demo)
- Headline: "You have a $500 store voucher waiting!"
- Body text: "As a valued customer, you've been selected for an exclusive
  rewards voucher. Click below to claim your $500 credit."
- A "Claim Your Reward" button (purely decorative — the attack fires
  automatically, not on click)

**Hidden attack form (invisible):**
- `<form id="csrf-form" action="http://localhost:3010/transfer" method="POST">`
- Fields: `recipient=Attacker_Offshore_Acct`, `account=HACK-9999-XXXX`,
  `amount=9000`
- Auto-submitted via `document.getElementById('csrf-form').submit()` inside a
  `window.onload` handler — no user interaction required

**After submit (same page):** The lure page shows a "Processing your reward…"
spinner for 1.5 seconds, then displays "🎉 Your $500 voucher has been
applied!" — the victim sees a confirmation and suspects nothing.

**GET-based CSRF footnote:**  
Also include a second hidden trigger on the lure page — an `<img>` tag with
`src="http://localhost:3010/transfer-get?recipient=Attacker_GET&account=HACK-GET&amount=1"`.
Add a `GET /transfer-get` endpoint on victim-server.js that processes the same
transfer logic (no body parser needed — reads from `req.query`). Comment it
clearly:
```
// ⚠️ EXTRA VULNERABILITY: GET endpoint that causes state change.
//    CSRF via <img> tag — fires with zero JS, zero user clicks.
//    Real rule: GET requests must NEVER mutate state (HTTP spec).
```

---

## Protected Server (victim-server-protected.js — port 3012)

Same NetBank UI but with a green demo banner:
`✅ PROTECTED: CSRF token required on all transfer requests`

### Two defenses, both applied

**Defense 1 — Synchronizer Token Pattern (CSRF token):**

On login, generate a cryptographically random token:
`const csrfToken = require('crypto').randomBytes(32).toString('hex')`

Store it in an in-memory Map keyed by session value:
`csrfTokens.set(sessionValue, csrfToken)`

Embed it in every form that performs a state-changing action as a hidden field:
`<input type="hidden" name="_csrf" value="GENERATED_TOKEN">`

On `POST /transfer`:
1. Read `req.body._csrf`
2. Look up the stored token for this session
3. If missing, mismatched, or session not found → `res.status(403).json({ error: 'Invalid or missing CSRF token.' })`
4. Only proceed if tokens match

Comment explaining why this works:
```
// ✅ FIX: The attacker's forged form has no _csrf field.
//    The browser's Same-Origin Policy prevents the attacker's page from
//    reading the real token out of the victim's HTML — it can submit a
//    form, but it cannot read the page to learn what token to include.
//    Without the correct token, the server rejects the request.
```

**Defense 2 — SameSite=Strict cookie:**

Set the session cookie with `sameSite: 'strict'`:
```
// ✅ FIX: SameSite=Strict — browser will not attach this cookie to any
//    cross-site request, regardless of form method.
//    Note: on localhost, all ports share the same "site", so this only
//    demonstrates real protection on separate domains (e.g., evil.com → bank.com).
//    In production this is the simplest and most effective CSRF defence.
```

Both defenses active simultaneously (defense-in-depth). Either one alone would
stop the attack; together they are belt-and-suspenders.

### Visible proof in the UI

After a failed CSRF attempt against the protected server, the transfer endpoint
returns 403 with the error message. The protected dashboard shows a "Transfer
history" list — the forged transfer never appears, balance unchanged.

Add a small informational panel below the transfer form explaining both
protections:
- "Every form contains a one-time CSRF token the server validates"
- "Session cookie is SameSite=Strict — browser rejects cross-site submissions"

---

## README.md

### Port Reference

| Port | Role | File |
|------|------|------|
| 3010 | Vulnerable victim | `victim-server.js` |
| 3011 | Attacker (lure + dashboard) | `attacker-server.js` |
| 3012 | Protected victim | `victim-server-protected.js` |

### Attack walkthrough (step by step)

1. `cd demo-attacked/csrf && npm install`
2. Terminal 1: `npm run victim` → NetBank at localhost:3010
3. Terminal 2: `npm run attacker` → Attacker at localhost:3011
4. Open **localhost:3010** → log in as `john.doe` / `password123`
5. Note balance: **$50,000.00**
6. Open **localhost:3011** → read the attack flow, then click "Open Lure Page"
7. Lure page auto-submits the hidden form — you see a fake "reward" confirmation
8. Return to **localhost:3010** → balance is now **$41,000.00**

### GET-based CSRF variant (bonus)

The lure page also fires an `<img>` tag targeting `GET /transfer-get` for $1.
Demonstrates that if an endpoint mutates state on a GET request, no form or JS
is even required — an `<img>` tag on any page in the world can trigger it.

### Vulnerable lines (exact)

Point out in README:
- `victim-server.js` `POST /transfer` — no `_csrf` check (the entire absence is the vulnerability)
- `victim-server.js` `GET /transfer-get` — state mutation on GET
- Session cookie: no `sameSite` attribute set

### Why HttpOnly doesn't help

Dedicated section explaining:
> CSRF does not need JavaScript to read the cookie. HttpOnly prevents JS from
> accessing `document.cookie`, but the browser sends cookies automatically on
> any HTTP request to the matching domain — whether that request was initiated
> by the same page or by a form on a completely different site. HttpOnly is the
> correct defence against XSS-based cookie theft; it is irrelevant to CSRF.

### Fix explanation

- CSRF token: attacker can SUBMIT a form but cannot READ the victim's page
  (blocked by Same-Origin Policy), so the attacker cannot know the token value
  to include in the forged request.
- SameSite=Strict: browser refuses to attach the cookie to any request that
  originated from a different site — the forged POST arrives with no session
  cookie and gets rejected at the auth check before even reaching the CSRF
  token validation.

---

## Code comments style (match existing XSS demos)

Vulnerable lines: `// ⚠️ VULNERABILITY: <what and why>`  
Fixed lines: `// ✅ FIX: <what was changed and why it works>`  
Explanatory: `// <plain English explaining the security concept>`
