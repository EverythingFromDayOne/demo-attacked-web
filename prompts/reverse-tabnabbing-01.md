# Cursor Prompt: Reverse Tabnabbing Demo — TechBlog

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015).
This demo lives under `demo-attacked/reverse-tabnabbing/` using ports 3016–3018.

Tech stack: Node.js + Express only. All HTML as template literals. Vanilla CSS/JS.

---

## Files to create

```
demo-attacked/reverse-tabnabbing/
├── victim-server.js            # TechBlog vulnerable  — port 3016
├── victim-server-protected.js  # TechBlog protected   — port 3018
├── attacker-server.js          # Attacker pages       — port 3017
├── package.json
├── .gitignore
└── README.md
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

Dependencies: `express`, `cors` only.

---

## TechBlog App (victim-server.js — port 3016)

### Concept

A realistic tech news blog. The user is auto-authenticated as a reader.
The page lists articles — some internal, some "external" that open in a
new tab. The external link is the attack vector: it opens the attacker
page at localhost:3017 in a new tab. Without `rel="noopener"`, the new
tab can access and redirect the original tab.

### Critical detail — modern browser override

Chrome 88+ and Firefox 79+ silently add implicit `noopener` to all
`target="_blank"` links, breaking the demo on modern browsers UNLESS
the link explicitly sets `rel="opener"`.

The vulnerable server must use:
```html
<!-- ⚠️ VULNERABILITY: rel="opener" explicitly grants window.opener access.
     Without this, Chrome 88+ implicitly adds noopener and blocks the attack.
     In real codebases this appears in old code, third-party widgets, or
     libraries that predate the Chrome 88 default change (January 2021). -->
<a href="http://localhost:3017" target="_blank" rel="opener nofollow">
  Read Full Article →
</a>
```

Comment this clearly in the code. This is a key teaching point:
the browser default changed in 2021, but `rel="opener"` re-enables
the attack even on fully updated Chrome.

### Visual design

Clean editorial layout. White background, dark text, teal accent (`#0d9488`).
Logo: "TechBlog 📰". Header has logo, nav (Home, Topics, Newsletter), and
a user badge showing "👤 Alex Reader" (auto-authenticated).

Orange demo banner at top:
`⚠️ VULNERABLE: External links use rel="opener" — window.opener accessible from new tab`

### Article list

Show 4 article cards in a 2-column grid:

1. **"The Hidden Cost of Technical Debt"** — internal link (`/articles/1`)
   *12 min read · Engineering*
2. **"How AI Is Reshaping Frontend Development"** — **external link**
   pointing to `http://localhost:3017` — opens in new tab with `rel="opener nofollow"`
   *8 min read · AI & Tools* — mark with a small "↗ External" badge
3. **"Building Resilient Microservices"** — internal link (`/articles/3`)
   *15 min read · Architecture*
4. **"CSS Container Queries in Production"** — internal link (`/articles/4`)
   *6 min read · Frontend*

The external article (card 2) should look indistinguishable from the internal
ones — no visible warning, no special styling beyond the "↗ External" badge.
This is realistic: users routinely click external links without noticing.

### Session

Auto-set a cookie on first visit (no login flow):
```
name:     blog_session
value:    AlexReader_t0k3n_BLOG456
httpOnly: false
path:     /
```

### Internal article pages (`GET /articles/:id`)

Serve a simple article page with placeholder lorem ipsum content so the
blog feels real. Include a "← Back to Home" link.

---

## Attacker Server (attacker-server.js — port 3017)

Serves three routes:

### GET / — The fake external article

Looks like a legitimate external tech blog post. Title: "How AI Is
Reshaping Frontend Development". Has a hero image placeholder, author
byline, a few paragraphs of readable content about AI tools.

The entire page is credible content — the victim has no reason to suspect anything.

**The attack fires silently on page load:**

```js
// Executes immediately when the new tab loads
if (window.opener && !window.opener.closed) {
  // Redirect the original tab to our phishing clone while the user
  // is distracted reading this page.
  window.opener.location = 'http://localhost:3017/phish';
}
```

No visible indication to the victim that anything happened.

Add a subtle "Reading time: ~8 min" and scroll indicator to keep the
victim engaged on this tab while the original tab is silently swapped.

### GET /phish — Pixel-perfect TechBlog phishing clone

**This is the most critical page to get right.** It must look IDENTICAL
to the real TechBlog at localhost:3016:
- Same color scheme, same logo ("TechBlog 📰"), same header, same fonts
- Same article grid visible in the background (blurred/dimmed)
- A centered modal overlay: "Session Expired"
  - Message: "Your session has timed out for security. Please sign in to continue."
  - Username input (pre-filled with "alex.reader@email.com")
  - Password input
  - "Sign In" button (teal, matches TechBlog style)
  - Small text: "© TechBlog · Privacy · Terms"

The URL in the browser address bar will show `localhost:3017/phish` — but
users frequently don't check the URL after a tab switch. The phishing page
depends on this inattention.

On form submit: POST to `POST /api/steal` with the credentials, then
redirect to `http://localhost:3016` (back to the real blog, looking like
a successful re-login).

### POST /api/steal — Credential receiver

Stores `{ username, password, timestamp, userAgent }` in memory.
Returns `{ success: true }`.

### GET /api/stolen — Returns stolen credentials list

Used by the attacker dashboard.

### GET /dashboard — Attacker control panel

Dark terminal aesthetic (same as other attacker dashboards in the lab).
Shows:
- Title: "Reverse Tabnabbing Attack Lab"
- Attack flow explanation (numbered steps)
- Table of stolen credentials: Username | Password | Timestamp
- Polling every 3 seconds via `GET /api/stolen`
- Empty state: "Waiting for victim to submit credentials..."

---

## Protected Server (victim-server-protected.js — port 3018)

Identical TechBlog UI. Changes:

**Green demo banner:**
`✅ PROTECTED: External links use rel="noopener noreferrer" — window.opener is null`

**The external link:**
```html
<!-- ✅ FIX: rel="noopener" sets window.opener to null in the new tab —
     the attacker page cannot read or modify the original tab's location.
     rel="noreferrer" additionally prevents the Referer header from being
     sent, protecting the user's navigation history. -->
<a href="http://localhost:3017" target="_blank" rel="noopener noreferrer">
  Read Full Article →
</a>
```

Apply via a server-side middleware that adds the header:
```js
// ✅ FIX: Referrer-Policy header as defense-in-depth
res.setHeader('Referrer-Policy', 'no-referrer');
```

When the victim clicks the external link from the protected server:
- The new tab (attacker page at 3017) loads normally
- `window.opener` is `null`
- The `if (window.opener)` check fails silently
- The original tab stays on TechBlog exactly as the user left it
- Switching back shows TechBlog intact, not a phishing page

---

## Victim Switcher (bottom-left, match all other attacker pages)

Add to the attacker dashboard (`GET /dashboard`):
- `Vulnerable (:3016)` — dark button, opens localhost:3016 in new tab
- `Protected (:3018)` — red button, opens localhost:3018 in new tab

Same fixed bottom-left styling as XSS and CSRF attacker pages.

---

## README.md

### Port Reference

| Port | Role | File |
|------|------|------|
| 3016 | Vulnerable victim (TechBlog) | `victim-server.js` |
| 3017 | Attacker (fake article + phishing clone) | `attacker-server.js` |
| 3018 | Protected victim (TechBlog) | `victim-server-protected.js` |

### Attack walkthrough

1. `cd demo-attacked/reverse-tabnabbing && npm install`
2. Terminal 1: `npm run victim` → TechBlog at **localhost:3016**
3. Terminal 2: `npm run attacker` → Attacker at **localhost:3017**
4. Open **localhost:3016** — you are logged in as Alex Reader.
5. Click **"How AI Is Reshaping Frontend Development ↗"** — a new tab opens
   with the external article.
6. Read a sentence or two (the tab swap has already happened silently).
7. Switch back to the original tab.
8. You are now on **localhost:3017/phish** — a TechBlog login page asking
   you to re-authenticate. The URL gives it away, but most users don't check.
9. Type any credentials and submit.
10. Open **localhost:3017/dashboard** — your credentials appear instantly.

### Protected demo

1. Terminal 3: `npm run victim-protected` → protected TechBlog at **localhost:3018**
2. Open **localhost:3018**, click the same external article.
3. Switch back — original tab is still on TechBlog, untouched.
4. On the attacker page, `window.opener` is `null` — the redirect silently failed.

### Why modern browsers don't fully solve this

Chrome 88+ (Jan 2021) added implicit `noopener` to all `target="_blank"` links.
This would block the attack without any code change. However:

- The demo uses explicit `rel="opener"` to show what happens with old code or
  third-party widgets that predate Chrome 88
- Any library or CMS that generates `target="_blank"` links before 2021 without
  `rel="noopener"` is still vulnerable in older browsers
- `rel="opener"` can be set intentionally or by mistake and completely bypasses
  the browser default
- The fix (`rel="noopener noreferrer"`) has been the correct answer since 2015
  — relying on the browser default instead of writing it explicitly is fragile

Always write `rel="noopener noreferrer"` explicitly. Don't rely on browser defaults.

### Vulnerable line (exact)

`victim-server.js` — the external article link:

```html
<a href="http://localhost:3017" target="_blank" rel="opener nofollow">
```

The vulnerability is `rel="opener"`. Removing it (or replacing with
`rel="noopener noreferrer"`) fully neutralises the attack.

### Defense details

- `rel="noopener"` — sets `window.opener = null` in the new tab. The
  attacker page cannot reference or redirect the original tab.
- `rel="noreferrer"` — additionally suppresses the `Referer` header so
  the destination page doesn't learn which page the user came from.
  Also implies `noopener` in all modern browsers.
- `Referrer-Policy: no-referrer` header — server-level defense that
  applies to all navigation from this page, not just links with the attribute.

### Code comment style (match existing demos)

```
// ⚠️ VULNERABILITY: <what and why>
// ✅ FIX: <what was changed and why it works>
```
