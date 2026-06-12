# Cursor Prompt — Stored XSS Demo: Customer Support Ticket Portal

## Context

This is a security education demo. The goal is to demonstrate a real-world Stored XSS attack
in a believable, production-like environment. Every piece of the demo must look and feel like
a real app — not a toy CTF challenge. The vulnerability is intentional and must be clearly
labeled as such in code comments.

---

## Real-World Scenario

**Target:** A B2B SaaS helpdesk portal.
**Victim role:** Support Agent "John" — authenticated, has a valuable session cookie.
**Attacker role:** A malicious customer who submits a support ticket.
**Attack:** The attacker embeds a JavaScript payload inside a ticket's message body.
When Agent John opens his dashboard and expands the ticket, the script silently fires
and exfiltrates his session cookie to the attacker's remote collector server.

This exact attack vector has been documented in dozens of public CVE reports and HackerOne
disclosures (e.g., stored XSS in Zendesk, Freshdesk clones, and internal ticketing systems).

---

## File Structure to Create

All files go inside `demo-attacked/xss/stored/`:

```
demo-attacked/
  xss/
    stored/
      victim-server.js      — Vulnerable helpdesk backend (port 3001)
      attacker-server.js    — Attacker's cookie collector backend (port 3002)
      victim.html           — Customer-facing: submit a support ticket
      admin.html            — Agent dashboard: review all tickets
      attacker.html         — Attacker's real-time stolen cookie dashboard
      package.json          — dependencies: express, cors, uuid
  prompts/
    xss-stored-01.md        — (this file)
```

---

## File 1: `victim-server.js` (port 3001)

An Express server representing the vulnerable helpdesk company.

**Routes:**
- `GET /` → serves `victim.html`
- `GET /admin` → serves `admin.html` AND sets a session cookie:
  `agent_session=AgentJohn_s3ss10n_t0k3n_XYZ789; Path=/; HttpOnly=false`
  The cookie must NOT be HttpOnly so JS can read it (demonstrating why HttpOnly matters).
  Add a comment in code: `// VULNERABILITY: HttpOnly=false — JS can read this cookie`
- `POST /api/tickets` → accepts JSON body `{ name, email, subject, message }`.
  Stores ticket in an in-memory array. Does NOT sanitize or encode any field.
  Add a comment: `// VULNERABILITY: raw user input stored and later rendered as HTML`
- `GET /api/tickets` → returns all stored tickets as JSON array, in reverse chronological order.
- Serves static files from the `stored/` directory.

**Startup:** Pre-seed 2 legitimate tickets so the board isn't empty.
Ticket 1: from "Alice Chen", subject "Cannot export CSV report", routine support question.
Ticket 2: from "Bob Martinez", subject "Billing invoice discrepancy", asking about an overcharge.
Both tickets have normal plain-text messages with no HTML.

---

## File 2: `attacker-server.js` (port 3002)

A tiny Express server representing the attacker's remote machine.

**Routes:**
- `GET /steal` → query param `c` contains the stolen cookie string. Store it in-memory
  with a timestamp. Respond with a 1x1 transparent GIF (Content-Type: image/gif) so the
  browser doesn't show any error. Log to console: `[STOLEN] Cookie received: <value>`.
- `GET /api/stolen` → returns JSON array of all stolen cookies with timestamps.
- `GET /` → serves `attacker.html`.

**CORS:** Enable CORS for all origins (the victim page will be loading an image from here,
which bypasses CORS, but enable it anyway for the API polling from attacker.html).

---

## File 3: `victim.html` — Customer Support Portal

Design: Clean, professional SaaS look. Blue/white color scheme. Fake company name: "NovaCRM".
Header: NovaCRM logo (text), nav links "Home", "Docs", "Status". Looks like a real product.

**Section 1 — Submit a Ticket form:**
Fields: Full Name, Email, Subject, Message (textarea, min 4 rows).
Submit button: "Send Ticket". On submit, POST to `/api/tickets` via fetch with JSON body.
On success: show a green banner "Your ticket has been submitted. We'll respond within 24h."
Clear the form after submit.

**Section 2 — Recent Tickets (public feed, like a community forum):**
Below the form, show a heading "Recent Community Tickets" with a subtext
"Our support team responds publicly to help the whole community."
Poll `GET /api/tickets` on load and every 3 seconds.
Render each ticket as a card: show submitter name, subject, and message body.

**CRITICAL — THE VULNERABILITY:**
The message body must be rendered using `element.innerHTML = ticket.message`.
Add a comment directly above this line:
```
// ⚠️  VULNERABILITY: innerHTML renders raw HTML — never do this with user input
// Safe alternative: element.textContent = ticket.message
```

Style: each ticket card has a subtle left border. Timestamp shown in relative time (e.g., "2 min ago").

---

## File 4: `admin.html` — Agent Dashboard

Design: Dark sidebar layout. Sidebar shows agent avatar (initials "JD"), name "Agent John Doe",
role badge "Support Agent", and a fake org "NovaCRM Internal". Main content area lists tickets.

**On page load:**
- Fetch `GET /api/tickets` and render the ticket list.
- Show a yellow info banner at the top:
  `⚠️ Demo: Your session cookie is: <show document.cookie here dynamically>`
  This makes the cookie visible so the user can see what's about to be stolen.

**Ticket list:**
Each ticket shown as a row: submitter name, subject, a "View" button, timestamp.
Clicking "View" expands an inline panel below the row showing the full ticket message.

**CRITICAL — THE VULNERABILITY:**
Same as victim.html — expand panel renders message via `innerHTML`.
Same code comment must appear.

**No authentication UI needed** — the agent is "already logged in" (cookie set by server on /admin visit).

---

## File 5: `attacker.html` — Attacker's Cookie Collector

Design: Dark terminal aesthetic. Black background, green monospace font. Like a hacker movie
but real. Title: "Cookie Collector — Waiting for victims..."

**Behavior:**
- Poll `GET /api/stolen` (on attacker-server port 3002) every 1.5 seconds.
- While no cookies received: show a blinking cursor animation and text "Listening on port 3002..."
- When a cookie arrives: play a subtle CSS flash animation (green glow), show:
  ```
  [COOKIE CAPTURED] 2026-06-09 14:32:01
  agent_session=AgentJohn_s3ss10n_t0k3n_XYZ789
  ```
- Each stolen entry shown as a new block, newest at top.
- Counter at top: "Cookies stolen: N"

**Attack payload instructions panel (bottom of page):**
A gray box labeled "Attack Payload Used:" showing the exact image-based XSS payload:

  Submitter name: Attacker
  Subject: Having trouble logging in
  Message: (the XSS payload using an img onerror that fetches /steal on port 3002)

The payload uses `<img src="x" onerror="...">` technique to send `document.cookie`
as a query param to `http://localhost:3002/steal`. Use encodeURIComponent on the cookie value.

Show the payload in a styled `<pre>` code block so the user can copy-paste it into the victim form.

---

## File 6: `package.json`

Standard Node.js package.json. Name: `xss-stored-demo`. Dependencies: `express`, `cors`, `uuid`.
Two scripts: `"victim": "node victim-server.js"` and `"attacker": "node attacker-server.js"`.

---

## How to Run (add as a comment block at the top of both server files)

```
Terminal 1: cd demo-attacked/xss/stored && npm install && npm run victim
Terminal 2: cd demo-attacked/xss/stored && npm run attacker

Then open:
  http://localhost:3001/admin  ← Open first to set the agent cookie
  http://localhost:3002        ← Attacker dashboard (open in a separate window)
  http://localhost:3001        ← Customer portal (paste the payload here as a new ticket)
```

---

## Code Quality Requirements

- Every intentional vulnerability must have a `// ⚠️  VULNERABILITY:` comment explaining WHY it's vulnerable.
- Every safe alternative must be mentioned in a `// ✅  FIX:` comment directly below.
- No TypeScript — plain JS (CommonJS require syntax for Node).
- No build step. Must run with `node victim-server.js` directly.
- No external CSS frameworks. Inline `<style>` blocks only. CSS must be good enough to look like a real product.
- No placeholder lorem ipsum text anywhere. All copy must be realistic SaaS product language.
