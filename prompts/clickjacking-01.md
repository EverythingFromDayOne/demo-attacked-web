# Cursor Prompt: Clickjacking Attack Demo — CloudVault File Storage

## Context

Part of a security attack demonstration lab at https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (ports 3001–3009), CSRF (ports 3010–3012).
This demo lives under `demo-attacked/clickjacking/` and uses ports 3013–3015.

Tech stack: Node.js + Express. All HTML served as template literals from the server. Vanilla CSS and JS only.

---

## Files to create

```
demo-attacked/clickjacking/
├── victim-server.js            # CloudVault vulnerable   — port 3013
├── victim-server-protected.js  # CloudVault protected    — port 3015
├── attacker-server.js          # Attacker overlay page   — port 3014
├── package.json
└── .gitignore
```

---

## .gitignore

```
node_modules/
.env
*.log
```

---

## Package.json scripts

```
victim            → node victim-server.js
attacker          → node attacker-server.js
victim-protected  → node victim-server-protected.js
```

Dependencies: `express` only.

---

## CloudVault App (victim-server.js — port 3013)

### Concept

A cloud file storage dashboard. The user is auto-authenticated on first visit
(no manual login required — simulates a user who is already logged in, which
is the realistic precondition for clickjacking). The page has a prominent
"Delete All Files" button. That button is the clickjacking target.

### Session

On every request, set a cookie automatically if absent:
```
name:     vault_session
value:    VaultUser_demo_TOKEN
httpOnly: false   ← intentional: this demo is about UI deception, not cookie theft
path:     /
```

No login flow needed.

### Visual design

Color scheme: dark navy (`#0f172a`) header, white cards, red accent for
destructive actions. Logo: "CloudVault 🗄️".

Red demo banner at top:
`⚠️ VULNERABLE: No X-Frame-Options — this page can be loaded inside any iframe`

### Dashboard layout

**Header:** CloudVault logo, nav links (Files, Shared, Trash, Settings), user
avatar placeholder "V".

**Storage summary panel:** "5 of 15 GB used" with a usage bar.

**File list** (6 pre-seeded fake files, rendered as a table):

| Name | Type | Size | Modified |
|------|------|------|----------|
| Q2-Financial-Report.xlsx | Spreadsheet | 2.4 MB | 2 days ago |
| Product-Roadmap-2026.pdf | PDF | 1.1 MB | 5 days ago |
| Team-Photo-Offsite.jpg | Image | 4.8 MB | 1 week ago |
| Client-Contract-NDA.docx | Document | 890 KB | 2 weeks ago |
| Architecture-Diagram-v3.png | Image | 3.2 MB | 3 weeks ago |
| Backup-Config-prod.tar.gz | Archive | 12.1 MB | 1 month ago |

**Action buttons (below the file list):**

- `Make Account Public` — yellow warning button, triggers a non-destructive
  modal that just shows "Account is now public — anyone can view your files."
- `Delete All Files` — solid red button, the primary clickjacking target.
  When clicked: shows a confirm dialog `Are you sure? This cannot be undone.`
  On confirm: clears the file list, replaces it with an empty state panel:
  "No files found. Your storage is empty." and shows a red alert banner:
  "⚠️ All files have been permanently deleted."

**Important layout constraint:** The `Delete All Files` button must be
positioned at a predictable, fixed location — bottom-center of the main
content area, with enough surrounding whitespace that the attacker can align
an overlay button precisely over it. Use `margin: 2rem auto`, `display: block`,
`width: 220px` so its position is stable.

### HTTP headers (vulnerable version)

No `X-Frame-Options` header. No `Content-Security-Policy` header.
Comment in code:
```
// ⚠️ VULNERABILITY: No X-Frame-Options or CSP frame-ancestors header.
//    Any page on any origin can embed this app inside an <iframe> and
//    position invisible interactive elements over it.
```

---

## Attacker Server (attacker-server.js — port 3014)

### Concept

A fake "CloudBoost" promotion page. The victim sees an attractive upgrade
offer and clicks a button. They don't know a transparent iframe of CloudVault
is layered underneath — their click hits "Delete All Files" on the real app.

### Page design

Branding: "CloudBoost ☁️ — Supercharge your storage"

Content visible to the victim:
- Headline: "You've been selected for a free 2TB upgrade!"
- Subtext: "As an active CloudVault user, you qualify for our premium tier —
  completely free for 12 months. Claim before the offer expires."
- A countdown timer (fake — counts from 04:59 downward using setInterval)
- A large green CTA button: "Claim My Free Upgrade →"
- Trust signals below: "🔒 Secure", "✅ No credit card", "⭐ 4.9/5 rating"

### The hidden iframe

Underneath the visible page — at `z-index: 1` with the CTA button at
`z-index: 3` — place an iframe loading `http://localhost:3013`:

```html
<iframe
  src="http://localhost:3013"
  style="
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0;
    pointer-events: none;
    z-index: 1;
    border: none;
  "
  id="victim-frame"
></iframe>
```

The CTA button must be positioned at `position: fixed` with exact `top` and
`left` values so it sits precisely over CloudVault's "Delete All Files" button
when the iframe is full-viewport. Use `top: 62%` and `left: 50%`,
`transform: translateX(-50%)` — matching the victim page layout constraints
specified above.

When the CTA button is clicked, `pointer-events` on the iframe switches to
`all` for a brief moment to let the underlying click register, then switches
back. Actually simpler: remove `pointer-events: none` from the iframe entirely
and rely on the z-index stacking — the CTA button at z-index 3 captures the
click visually, but the iframe receives the actual click event because the
button is transparent. Model this correctly:

The correct clickjacking CSS model:
- iframe: `opacity: 0; z-index: 2` (on top, invisible, receives clicks)
- CTA button: `z-index: 1; pointer-events: none` (visible, decorative only)
- The victim sees the button but the iframe intercepts all clicks

Add `<p class="click-hint">👆 Click anywhere on the button above</p>` below
the CTA.

### Debug mode toggle

A small button fixed to the bottom-right corner: "🔍 Show Overlay".

When toggled ON: sets the iframe's `opacity` to `0.4` and adds a red border so
the viewer can see the CloudVault dashboard underneath and understand the
alignment. The CTA button gets a semi-transparent red background.

When toggled OFF: resets to the invisible attack state.

This is the most important teaching feature of the whole demo — it makes the
deception visible.

### Attacker dashboard (GET /)

The lure page described above IS the dashboard. No separate attacker tracking
needed for clickjacking — the attack is visual/behavioral, not data-exfiltration.

---

## Protected Server (victim-server-protected.js — port 3015)

Identical CloudVault UI and functionality, with these changes:

**Green demo banner:**
`✅ PROTECTED: X-Frame-Options: DENY + CSP frame-ancestors 'none'`

**HTTP headers added to every response:**
```js
// ✅ FIX (primary): X-Frame-Options tells the browser to refuse rendering this
//    page inside any <iframe>, <frame>, or <object> element.
//    DENY = no framing by anyone.
//    SAMEORIGIN = framing allowed only from the same origin.
res.setHeader('X-Frame-Options', 'DENY');

// ✅ FIX (modern): CSP frame-ancestors supersedes X-Frame-Options in all
//    modern browsers. More flexible — can specify multiple allowed origins.
//    'none' = equivalent to X-Frame-Options: DENY.
//    'self' = equivalent to X-Frame-Options: SAMEORIGIN.
res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
```

Apply via a global middleware at the top of the app so every route is covered.

### What happens when the attacker tries to iframe port 3015

The browser itself refuses to render the iframe. The attacker page shows the
iframe element but it stays blank/white. Add this to the attacker server's
HTML: a second "test protected" link so the demo viewer can swap the iframe
src between 3013 and 3015 and observe the difference.

In the iframe, add an `onerror` / `onload` handler that attempts to detect if
the frame was blocked and shows a message on the attacker page:
"🛡️ Iframe blocked — target server sent X-Frame-Options: DENY".
Note in a comment that this detection is unreliable cross-origin (browsers
may not fire onerror for header-blocked frames), so the primary evidence is
the blank iframe + browser console error.

---

## Frame-Buster Script — Why It Fails (include as commented code in victim-server.js)

Old-school developers tried to prevent clickjacking with JavaScript:

```js
// ❌ FAILED DEFENCE — DO NOT USE
// Frame-buster: if this page is inside an iframe, break out of it.
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

Include this as a commented block in victim-server.js with the explanation.
This is a critical teaching point: JavaScript cannot defend against clickjacking.
Only HTTP headers can.

---

## README.md

### Port Reference

| Port | Role | File |
|------|------|------|
| 3013 | Vulnerable victim (CloudVault) | `victim-server.js` |
| 3014 | Attacker overlay (CloudBoost lure) | `attacker-server.js` |
| 3015 | Protected victim (CloudVault) | `victim-server-protected.js` |

### Attack walkthrough

1. `cd demo-attacked/clickjacking && npm install`
2. Terminal 1: `npm run victim` → CloudVault at localhost:3013
3. Terminal 2: `npm run attacker` → Attacker at localhost:3014
4. Open **localhost:3013** directly — note you have 6 files stored.
5. Now open **localhost:3014** — you see a CloudBoost upgrade promotion.
6. Click **"🔍 Show Overlay"** in the bottom-right corner — you can now see
   the transparent CloudVault iframe underneath, with "Delete All Files"
   aligned under the green button.
7. Toggle overlay OFF, then click **"Claim My Free Upgrade →"**.
8. Return to **localhost:3013** — all files are gone.

### Protected demo

1. Terminal 3: `npm run victim-protected` → protected CloudVault at localhost:3015
2. On the attacker page, change the iframe src to localhost:3015.
3. The iframe goes blank. Open browser DevTools console — see the
   X-Frame-Options refusal error.

### Vulnerable line (exact)

`victim-server.js` — the vulnerability is the **absence** of a header, not
the presence of bad code. Every route handler is missing:

```js
res.setHeader('X-Frame-Options', 'DENY');
```

Point this out explicitly: clickjacking vulnerabilities are omissions, not
commissions.

### Why the frame-buster script fails

Dedicated section covering the `sandbox` bypass — this is a well-known trap
that many developers have fallen into.

### Defense details

- `X-Frame-Options: DENY` — supported since IE8, universally supported
- `X-Frame-Options: SAMEORIGIN` — allows same-origin embeds (e.g. your own
  admin panel embedding your own pages)
- `CSP: frame-ancestors 'none'` — modern equivalent, preferred. Supports
  multiple allowed origins: `frame-ancestors 'self' https://dashboard.myapp.com`
- `X-Frame-Options` is ignored if CSP `frame-ancestors` is present in
  modern browsers — always set both for backward compatibility

### Code comment style (match existing demos)

```
// ⚠️ VULNERABILITY: <what and why>
// ✅ FIX: <what was changed and why it works>
// ❌ FAILED DEFENCE: <why this approach does not work>
```
