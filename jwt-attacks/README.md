# JWT Attacks Demo — AuthVault

## Port Reference

| Port | Role | File |
|------|------|------|
| 3034 | Vulnerable AuthVault | `victim-server.js` |
| 3035 | JWT Attack Lab | `attack-guide-server.js` |
| 3036 | Protected AuthVault | `victim-server-protected.js` |

---

## How to Run

```bash
cd demo-attacked/jwt-attacks
npm install
```

Three terminals:

```
npm run victim           # :3034
npm run guide            # :3035
npm run victim-protected # :3036
```

---

## Attack Walkthrough — alg:none

1. Open **localhost:3035**
2. Click **Login → :3034** (alice / hunter2)
3. Click **⚡ Forge alg:none Token** — role set to admin
4. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
5. Click **Test on Protected :3036** — `✗ Rejected`

---

## Attack Walkthrough — Weak Secret

1. With alice's token in the token field
2. Click **⚡ Crack HS256 Secret**
3. In ~40 tries it finds `"secret"`
4. A re-signed admin token appears automatically
5. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
6. Click **Test on Protected :3036** — `✗ Rejected` (different, unguessable secret)

---

## Vulnerable Lines

```js
// ⚠️ Trusts the alg field from the token header
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
if (header.alg === 'none') { /* skip verification */ }

// ⚠️ Weak secret — in the wordlist
const JWT_SECRET = 'secret';
```

---

## The Fix

```js
// ✅ Never read alg from the token — whitelist it here
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

// ✅ Strong secret
const JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
// Stored in process.env.JWT_SECRET, not hardcoded
```

---

## Logout — JWT Revocation Demo

1. Log in at **localhost:3034** → copy the token → click **Sign Out**
2. Go to the attack guide (3035) → paste the old token in Step 0 → click **Test Revoked Token on :3034** → `✓ Token rejected: "Token has been revoked"`
3. Restart the `:3034` server (`Ctrl+C`, `npm run victim`) → test again → token accepted again
4. This demonstrates: **in-memory denylists are not persistent** — production requires Redis or a database.

---

## Why jwt.decode() is dangerous

`jwt.decode()` in the `jsonwebtoken` package decodes a JWT without verifying
the signature. It should only be used AFTER `jwt.verify()` — never as a
replacement. Using `jwt.decode()` for authorization is equivalent to having no
auth at all.
