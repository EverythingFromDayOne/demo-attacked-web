# Clickjacking Attack Demo — CloudVault File Storage

## Port Reference

| Port | Role | File |
|------|------|------|
| 3013 | Vulnerable victim (CloudVault) | `victim-server.js` |
| 3014 | Attacker overlay (CloudBoost lure) | `attacker-server.js` |
| 3015 | Protected victim (CloudVault) | `victim-server-protected.js` |

---

## Attack Walkthrough

1. `cd demo-attacked/clickjacking && npm install`
2. Terminal 1: `npm run victim` → CloudVault at **localhost:3013**
3. Terminal 2: `npm run attacker` → Attacker at **localhost:3014**
4. Open **localhost:3013** directly — note you have 6 files stored.
5. Now open **localhost:3014** — you see a CloudBoost upgrade promotion.
6. Click **"🔍 Show Overlay"** in the bottom-right corner — you can now see the transparent CloudVault iframe underneath, with "Delete All Files" aligned under the green button.
7. Toggle overlay OFF, then click **"Claim My Free Upgrade →"**.
8. Confirm the dialog that appears (it comes from CloudVault, not CloudBoost).
9. Return to **localhost:3013** and refresh — all files are gone.

---

## Protected Demo

1. Terminal 3: `npm run victim-protected` → protected CloudVault at **localhost:3015**
2. On the attacker page, click **"Protected (:3015)"** in the bottom-left to swap the iframe target.
3. The iframe goes blank. Open browser DevTools console — see the X-Frame-Options refusal error.
4. A message may appear: "🛡️ Iframe blocked — target server sent X-Frame-Options: DENY"

> Cross-origin iframe blocking detection is unreliable — browsers may not fire `onerror` for header-blocked frames. The primary evidence is the blank iframe plus the browser console error.

---

## Vulnerable Line (Exact)

**`victim-server.js`** — the vulnerability is the **absence** of a header, not the presence of bad code. Every route handler is missing:

```js
res.setHeader('X-Frame-Options', 'DENY');
```

Clickjacking vulnerabilities are **omissions**, not commissions. The app works correctly — it simply never tells the browser it must not be embedded in a frame.

---

## Why the Frame-Buster Script Fails

Old-school developers tried to prevent clickjacking with JavaScript:

```js
// ❌ FAILED DEFENCE — DO NOT USE
if (window.top !== window.self) {
  window.top.location = window.self.location;
}
```

This fails because attackers use the `sandbox` attribute on the iframe:

```html
<!-- sandbox WITHOUT allow-top-navigation prevents the frame-buster from
     redirecting the parent page. The script runs but window.top.location
     assignment is silently blocked by the sandbox. -->
<iframe src="http://victim.com" sandbox="allow-scripts allow-forms"></iframe>
```

JavaScript cannot defend against clickjacking. Only HTTP headers can. See the commented block in `victim-server.js`.

---

## Defense Details

### `X-Frame-Options: DENY`

Supported since IE8, universally supported. Tells the browser to refuse rendering this page inside any `<iframe>`, `<frame>`, or `<object>` element.

- `DENY` — no framing by anyone
- `SAMEORIGIN` — framing allowed only from the same origin (e.g. your own admin panel embedding your own pages)

### `CSP: frame-ancestors 'none'`

Modern equivalent, preferred. Supports multiple allowed origins:

```
Content-Security-Policy: frame-ancestors 'self' https://dashboard.myapp.com
```

- `'none'` — equivalent to `X-Frame-Options: DENY`
- `'self'` — equivalent to `X-Frame-Options: SAMEORIGIN`

### Why both headers are set together

They protect different browsers at different points in history and form a fallback chain:

```
Modern browser (Chrome 40+, Firefox 36+, Safari 10+):
→ Sees CSP frame-ancestors 'none'
→ Enforces it
→ Ignores X-Frame-Options entirely (CSP wins)

Old browser (IE11, old Android WebView, legacy kiosk browser):
→ Doesn't understand CSP
→ Ignores Content-Security-Policy header completely
→ Falls back to X-Frame-Options: DENY
→ Enforces it
```

CSP `frame-ancestors` handles modern browsers. `X-Frame-Options` handles everything else. If you set only CSP and a user visits on IE11 or an old embedded WebView, they get zero clickjacking protection — the browser silently ignores the header it doesn't understand.

The cost of setting both is one extra line. There is no reason not to.

**The one exception:** if you need a multi-origin allowlist like
`frame-ancestors 'self' https://dashboard.partner.com`, you can only express that in CSP — `X-Frame-Options` has no multi-origin syntax. In that case, omit `X-Frame-Options` intentionally rather than let it contradict with a stricter `DENY`. For `'none'` and `'self'`, always set both.

**Protected server (`victim-server-protected.js`):**

```js
res.setHeader('X-Frame-Options', 'DENY');                              // fallback: old browsers
res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");   // modern browsers (wins)
```

---

## How the Attack Works

The attacker page uses a correct clickjacking CSS model:

| Layer | Element | z-index | pointer-events | Role |
|-------|---------|---------|----------------|------|
| Top | Invisible iframe (CloudVault) | 2 | auto | Receives all clicks |
| Bottom | Green CTA button | 1 | none | Visible decoration only |

The victim sees an attractive "Claim My Free Upgrade" button. Their click passes through to the invisible iframe underneath, hitting CloudVault's **Delete All Files** button. The iframe loads `?embed=1` and the attacker page syncs the delete-button position to the visible CTA via `postMessage` on load and resize.

Toggle **"🔍 Show Overlay"** to make the deception visible — the iframe becomes semi-transparent with a red border, and the CTA button gets a red tint so you can verify alignment.

---

## Reset Demo State

To restore the 6 seed files after a successful attack:

```bash
curl -X POST http://localhost:3013/reset
```
