# CSRF Attack Demo — NetBank Wire Transfer

## Port Reference

| Port | Role | File |
|------|------|------|
| 3010 | Vulnerable victim | `victim-server.js` |
| 3011 | Attacker (lure + dashboard) | `attacker-server.js` |
| 3012 | Protected victim | `victim-server-protected.js` |

---

## Attack Walkthrough

1. `cd demo-attacked/csrf && npm install`
2. Terminal 1: `npm run victim` → NetBank at **localhost:3010**
3. Terminal 2: `npm run attacker` → Attacker at **localhost:3011**
4. Open **localhost:3010** → log in as `john.doe` / `password123`
5. Note balance: **$50,000.00**
6. Open **localhost:3011** → read the attack flow, then click **Open Lure Page**
7. Lure page auto-submits the hidden form — you see a fake ShopNest "reward" confirmation
8. Return to **localhost:3010** → balance is now **$40,999.00** ($9,000 POST + $1 GET)

> The main attack is the **$9,000 wire transfer** via hidden POST form. The lure page also fires a GET-based CSRF via `<img>` for an additional **$1**.

---

## GET-Based CSRF Variant (Bonus)

The lure page includes:

```html
<img src="http://localhost:3010/transfer-get?recipient=Attacker_GET&account=HACK-GET&amount=1">
```

This demonstrates that if an endpoint mutates state on a **GET** request, no form and no JavaScript is required — an `<img>` tag on any page can trigger it.

The vulnerable server exposes `GET /transfer-get` which processes transfers from query parameters. The protected server returns **405 Method Not Allowed**.

---

## Vulnerable Lines (Exact)

**`victim-server.js` — `POST /transfer`**

```js
app.post('/transfer', (req, res) => {
  if (!isAuthenticated(req)) { ... }
  // ⚠️ VULNERABILITY: no CSRF token validation
  const { recipient, account, amount } = req.body;
  const result = processTransfer(recipient, account, amount);
```

The entire absence of a CSRF token check is the vulnerability. Any site can forge a POST if the victim holds a valid session cookie.

**`victim-server.js` — `GET /transfer-get`**

```js
app.get('/transfer-get', (req, res) => {
  // ⚠️ EXTRA VULNERABILITY: GET endpoint that causes state change
  const { recipient, account, amount } = req.query;
  const result = processTransfer(recipient, account, amount);
```

**Session cookie — no `sameSite` attribute**

```js
res.cookie('nb_session', SESSION_VALUE, { httpOnly: true, path: '/' });
// httpOnly: true — correct for XSS, irrelevant for CSRF
// sameSite omitted — cookie sent on cross-origin requests to localhost:3010
```

---

## Why HttpOnly Doesn't Help

CSRF does not need JavaScript to read the cookie. `HttpOnly` prevents JS from accessing `document.cookie`, but the **browser sends cookies automatically** on any HTTP request to the matching domain — whether that request was initiated by the same page or by a form on a completely different site.

| Attack | HttpOnly helps? |
|--------|-----------------|
| XSS cookie theft (`document.cookie`) | Yes |
| CSRF forged form POST | **No** — browser attaches cookie without JS |

`HttpOnly` is the correct defence against XSS-based cookie theft. It is irrelevant to CSRF.

---

## Fix Explanation

### Defense 1 — Synchronizer Token Pattern

On login, the protected server generates a random token and stores it server-side:

```js
const csrfToken = crypto.randomBytes(32).toString('hex');
csrfTokens.set(SESSION_VALUE, csrfToken);
```

Every transfer form includes `<input type="hidden" name="_csrf" value="...">`.

On `POST /transfer`, the server compares `req.body._csrf` to the stored value. The attacker's forged form has no `_csrf` field because:

- The attacker can **submit** a form to NetBank (cross-origin POST is allowed)
- The attacker **cannot read** NetBank's HTML (Same-Origin Policy blocks reading the token)

Without the correct token → **403 Forbidden**.

### Defense 2 — SameSite=Strict Cookie

```js
res.cookie('nb_session', SESSION_VALUE, { httpOnly: true, path: '/', sameSite: 'strict' });
```

The browser refuses to attach the cookie to requests that originated from a different site. A forged POST from `evil.com` arrives with no session cookie and fails at the auth check.

> **Localhost caveat:** All `localhost` ports share the same site in modern browsers, so `SameSite=Strict` may not block cross-port requests during local demos. On separate domains (`evil.com` → `bank.com`), this is the simplest and most effective CSRF defence. The CSRF token provides protection even on localhost.

---

## Running Protected vs Vulnerable Side-by-Side

```bash
# Terminal 1 — vulnerable
npm run victim          # port 3010

# Terminal 2 — protected
npm run victim-protected  # port 3012

# Terminal 3 — attacker (targets port 3010 by default)
npm run attacker        # port 3011
```

Log into both NetBank instances, then open the lure page. The vulnerable account loses $9,001; the protected account balance stays at $50,000.

---

## Defense Summary

| Layer | Vulnerable | Protected |
|-------|------------|-----------|
| CSRF token | Missing | Required on `POST /transfer` |
| SameSite cookie | Omitted | `strict` |
| GET state change | `GET /transfer-get` mutates balance | Returns 405 |
| HttpOnly | `true` (XSS protection only) | `true` |

---

## This Demo in Real Frameworks

---

### Pure SPA — React CRA, Angular CLI, Vue CLI (no SSR)

Pure SPAs typically use **stateless JWT authentication** stored in `localStorage` or memory — not cookies. Because the token is attached manually in the `Authorization` header (not automatically by the browser), a cross-origin forged form POST arrives at the server with no auth credential. CSRF is largely not a concern in this architecture.

```js
// React / Angular / Vue fetch — attacker cannot replicate this header via HTML form
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + jwtToken,  // manually attached — not a cookie
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ recipient, amount })
})
// A cross-origin forged form POST carries no Authorization header → 401 Unauthorized
```

**The exception:** If a SPA uses **cookie-based sessions** (common when the backend is shared with a mobile app, or when using `HttpOnly` cookies to protect the token from XSS), CSRF applies exactly as in this demo. Architecture determines exposure — not the framework name.

---

### SSR — Express+templates, Django, Laravel, Rails, Next.js pages router

This demo is a direct representation of this category. All major SSR frameworks embed CSRF tokens in server-rendered forms and validate them on every state-changing request.

| Framework | Token in form | Validated by |
|-----------|--------------|--------------|
| Django | `{% csrf_token %}` | `CsrfViewMiddleware` (global, on by default) |
| Laravel | `@csrf` (Blade) | `VerifyCsrfToken` middleware |
| Rails | `protect_from_forgery` | `ActionController::RequestForgeryProtection` |
| Express (no library) | Manual — exactly as in `victim-server-protected.js` | Manual route check |
| Next.js pages router | Manual — same pattern required | Manual route check |

The `victim-server-protected.js` `buildSpaHtml(csrfToken)` function is what Django's `{% csrf_token %}` and Laravel's `@csrf` do automatically. Using raw Express without a CSRF middleware (e.g., `csurf`) means you must implement the full synchronizer token pattern yourself — as this demo shows.

---

### Modern Hybrid — Next.js App Router, Nuxt 3, SvelteKit

**Server Actions** (Next.js 14+, SvelteKit form actions, Nuxt server actions) handle CSRF automatically at the framework level. No manual token is needed.

```tsx
// Next.js App Router — framework validates CSRF before this function runs
'use server'
async function transferAction(formData: FormData) {
  // Next.js has already verified the request origin internally
  const amount = formData.get('amount')
  const recipient = formData.get('recipient')
  await processTransfer(recipient, amount)
}

// Server Component — no hidden _csrf field required
export default function TransferForm() {
  return (
    <form action={transferAction}>
      <input name="recipient" />
      <input name="amount" type="number" />
      <button type="submit">Transfer</button>
    </form>
  )
}
```

**The caveat:** If the same Next.js App Router app also exposes traditional REST API routes (`/api/transfer/route.ts`) that use cookie-based auth — not server actions — **manual CSRF protection is still required on those routes**. The automatic protection only covers server actions, not `route.ts` handlers. A partially migrated codebase with a mix of server actions and API routes is a common real-world vulnerability surface.
