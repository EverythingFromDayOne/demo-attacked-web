/*
 * How to Run (protected / fixed version):
 *
 * Terminal 1: cd demo-attacked/xss/stored && npm run victim-protected
 * Terminal 2: cd demo-attacked/xss/stored && npm run attacker
 *
 * Compare with vulnerable server:
 *   http://localhost:3001/admin    ← vulnerable (httpOnly=false, cookie stolen)
 *   http://localhost:3003/admin    ← protected (httpOnly=true, XSS fires but cookie empty)
 */

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3003;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ✅ FIX: Content Security Policy as a last-resort layer.
//    'script-src self' blocks inline scripts and scripts from other origins.
//    If an XSS payload somehow executes, inline <script> tags and external
//    script sources are blocked. The onerror= and onload= event handlers
//    are NOT blocked by this policy (they need 'unsafe-inline' to be blocked),
//    so CSP alone is not sufficient — it is defense-in-depth, not the primary fix.
//    Real production: use a nonce-based CSP to block ALL inline scripts.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'"
  );
  next();
});

const tickets = [
  {
    id: uuidv4(),
    name: 'Alice Chen',
    email: 'alice.chen@meridian.io',
    subject: 'Cannot export CSV report',
    message:
      'Hi team — I am trying to export our Q2 pipeline report to CSV from the Analytics dashboard, but the download button spins indefinitely and never completes. I have tried Chrome and Firefox on Windows 11. Our account ID is MER-4821. Can you look into this? Thanks.',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: uuidv4(),
    name: 'Bob Martinez',
    email: 'bob.martinez@northwind.co',
    subject: 'Billing invoice discrepancy',
    message:
      'Hello, our March invoice shows 14 seats billed but we only have 11 active users in the workspace. Could you please review invoice #NV-2026-0347 and issue a credit or corrected invoice? Happy to provide a user list export if needed.',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
];

// ✅ FIX: Sanitize at ingestion point — strip HTML tags before storing.
//    Defense-in-depth: even if the rendering layer has a bug, the data is clean.
//    Note: this is NOT a substitute for safe rendering — do both.
//    Real production: use the 'dompurify' library (server-side via jsdom) or
//    'sanitize-html' npm package for allowlist-based sanitization.
function sanitizeText(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'victim-protected.html'));
});

app.get('/admin', (req, res) => {
  // ✅ FIX: httpOnly: true — document.cookie cannot read this token.
  //    Even if XSS fires, document.cookie returns '' for this field.
  //    The attack runs but the payload is worthless — no session data to exfiltrate.
  res.cookie('agent_session', 'AgentJohn_s3ss10n_t0k3n_XYZ789', { path: '/', httpOnly: true });
  res.sendFile(path.join(__dirname, 'victim-protected.html'));
});

app.post('/api/tickets', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const ticket = {
    id: uuidv4(),
    name: sanitizeText(name),
    email: sanitizeText(email),
    subject: sanitizeText(subject),
    message: sanitizeText(message),
    createdAt: new Date().toISOString(),
  };

  tickets.unshift(ticket);
  res.status(201).json(ticket);
});

// ✅ FIX: Data is sanitized at write time (POST /api/tickets).
//    The GET route returns already-clean data. Rendering layer still uses
//    textContent (see victim-protected.html) as second line of defense.
app.get('/api/tickets', (req, res) => {
  const sorted = [...tickets].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(sorted);
});

app.listen(PORT, () => {
  console.log(`NovaCRM PROTECTED server running at http://localhost:${PORT}`);
  console.log(`Compare vulnerable server at http://localhost:3001`);
});
