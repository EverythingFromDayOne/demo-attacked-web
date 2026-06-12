/*
 * How to Run:
 *
 * Terminal 1: cd demo-attacked/xss/stored && npm install && npm run victim
 * Terminal 2: cd demo-attacked/xss/stored && npm run attacker
 *
 * Then open:
 *   http://localhost:3001/admin  ← Open first to set the agent cookie
 *   http://localhost:3002        ← Attacker dashboard (open in a separate window)
 *   http://localhost:3001        ← Customer portal (paste the payload here as a new ticket)
 */

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'victim.html'));
});

app.get('/admin', (req, res) => {
  // ⚠️ VULNERABILITY: httpOnly: false — JavaScript can read this cookie via document.cookie
  // ✅ FIX: Set httpOnly: true (see victim-server-protected.js)
  res.cookie('agent_session', 'AgentJohn_s3ss10n_t0k3n_XYZ789', { path: '/', httpOnly: false });
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/api/tickets', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // VULNERABILITY: raw user input stored and later rendered as HTML
  // ✅  FIX: Sanitize/encode all user input before storage and always render with textContent
  const ticket = {
    id: uuidv4(),
    name,
    email,
    subject,
    message,
    createdAt: new Date().toISOString(),
  };

  tickets.unshift(ticket);
  res.status(201).json(ticket);
});

app.get('/api/tickets', (req, res) => {
  const sorted = [...tickets].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(sorted);
});

app.listen(PORT, () => {
  console.log(`NovaCRM helpdesk (victim) running at http://localhost:${PORT}`);
  console.log(`Agent dashboard: http://localhost:${PORT}/admin`);
});
