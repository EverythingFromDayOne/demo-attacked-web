# IDOR Attack Demo — PayrollHub

## Port Reference

| Port | Role | File |
|------|------|------|
| 3040 | Vulnerable PayrollHub | `victim-server.js` |
| 3041 | Attack guide | `attack-guide-server.js` |
| 3042 | Protected PayrollHub | `victim-protected-server.js` |

---

## Attack Flow

```
Attacker logs in as alice (user_id = 1)
        ↓
Attacker sends: GET /api/payslip/7   ← ID belongs to bob
        ↓
PayrollHub (3040): SELECT * FROM payslips WHERE id = 7
  (no AND user_id = ? check)
        ↓
Bob's payslip returned to alice — $92,000 salary exposed
        ↓
Enumerate IDs 1–12 → all 4 employees' salaries exposed in < 1 second
```

---

## What this demonstrates

The server checks authentication ("are you logged in?") but skips authorization ("do you own this resource?"). Because payslip IDs are sequential integers, an attacker who can see their own payslip at `/api/payslips/1` can read every other employee's payslip by incrementing the number.

---

## Vulnerable line

`victim-server.js` (via `payroll-app.js`):

```js
// ⚠️ No ownership check — user_id is never verified
const payslip = db.prepare('SELECT * FROM payslips WHERE id = ?').get(id);
```

---

## The fix

```js
// ✅ Must match BOTH the id AND the requesting user
const payslip = db.prepare(
  'SELECT * FROM payslips WHERE id = ? AND user_id = ?'
).get(id, req.user.id);
```

---

## Run the demo

```bash
cd demo-attacked/idor
npm install
npm run victim           # terminal 1 → localhost:3040
npm run attacker         # terminal 2 → localhost:3041
npm run victim-protected # terminal 3 → localhost:3042
```

### Walkthrough

1. Open **localhost:3041**
2. Click **Login → :3040** as alice
3. Fetch payslip ID **1** → alice's own payslip (expected)
4. Fetch payslip ID **7** → Charlie's payslip, annual salary $125,000 (IDOR)
5. Click **⚡ Enumerate IDs 1–12** → all 12 payslips returned, all 4 salary bands exposed
6. Switch to **:3042**, log in as alice, fetch ID **7** → 404 (ownership check blocks it)

---

## Key concepts

**Authentication vs Authorization:** Being logged in proves identity. It does not prove ownership of a resource. Every resource endpoint must check both.

**Why 404 not 403:** A 403 response tells the attacker the object exists at that ID. A 404 reveals nothing — the same response whether the ID doesn't exist or belongs to someone else.

**Sequential IDs make IDOR trivial:** UUIDs raise the bar (not a fix, but harder to enumerate). The real fix is always the server-side ownership check.

---

## Credentials

| User | Password | Role |
|------|----------|------|
| alice | alice123 | Engineering |
| bob | bob123 | Engineering |
| charlie | charlie123 | Management |
| hr | hr_admin | Human Resources |
