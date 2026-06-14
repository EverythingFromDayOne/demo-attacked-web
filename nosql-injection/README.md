# NoSQL Injection Attack Demo — DevAuth

## Port Reference

| Port | Role | File |
|------|------|------|
| 3022 | Vulnerable DevAuth | `victim-server.js` |
| 3023 | Attack guide | `attack-guide-server.js` |
| 3024 | Protected DevAuth | `victim-server-protected.js` |

---

## Attack Flow

```
Attacker sends: POST /api/login
  { "username": "admin", "password": { "$gt": "" } }
        ↓
DevAuth (3022) passes body directly to MongoDB:
  db.users.findOne({ username: "admin", password: { $gt: "" } })
        ↓
MongoDB evaluates: "is password > empty string?" → TRUE for every user
        ↓
Login succeeds. No password required.
```

---

## How to Run

```bash
cd demo-attacked/nosql-injection
npm install
```

Three terminals:

```
npm run victim           # :3022
npm run guide            # :3023
npm run victim-protected # :3024
```

---

## Attack Walkthrough

1. Open **localhost:3023** — read how the attack works.
2. Open **localhost:3022** — try `admin` with wrong password → fails.
3. Open DevTools → Network tab.
4. Run the curl payload or browser console fetch from the guide.
5. Dashboard loads — full user registry visible, no correct password used.
6. Click **Sign Out** to reset.

---

## Protected Demo

1. Open **localhost:3024** — send the same JSON injection payload.
2. Result: redirect to `/login?error=1` — operator object rejected before query runs.
3. Log in with correct credentials (e.g. `admin` / `Adm1nS3cr3t!`) to see the green legitimate-login banner.

---

## Vulnerable Line (Exact)

**`victim-server.js`** — `POST /login`:

```js
const user = findOne({ username, password });
// password was { "$gt": "" } — operator evaluated, password never compared
```

---

## The Fix

```js
if (typeof username !== 'string' || typeof password !== 'string') {
  return res.redirect('/login?error=1');
}
```

---

## Why JSON Endpoints Are Specifically Vulnerable

Form-encoded POST bodies cannot express nested objects — `password[$gt]=` arrives as the string `"$gt="`. Only JSON requests can carry nested objects, which is why this attack is specific to JSON APIs backed by document databases.

The login form sends JSON via `fetch()` so normal string logins work. The injection payload must be sent as JSON with a nested object (curl or DevTools).

---

## SQL vs NoSQL Injection Comparison

| | SQL Injection | NoSQL Operator Injection |
|---|---|---|
| Attack vector | String concatenation in SQL | Object passed as query field |
| Input format required | Any string | JSON (nested object) |
| Injected payload | `OR 1=1`, `UNION SELECT`, `--` | `$gt`, `$ne`, `$regex` |
| Defense | Parameterized queries | Type validation (enforce string) |
| Login bypass payload | `admin'--` | `{ "password": { "$gt": "" } }` |

---

## Defense Details

**Why type checking works:** MongoDB operator injection requires the query field to be an object. `{ password: { $gt: '' } }` executes the operator. `{ password: "$gt: ''" }` (a string) does exact string comparison and fails.

**Defense in depth:** In production, also use Mongoose schema validation, `express-mongo-sanitize` middleware, and input length limits.
