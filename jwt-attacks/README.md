# JWT Attacks Demo — AuthVault

## Port Reference

| Port | Role | File |
|------|------|------|
| 3034 | Vulnerable AuthVault | `victim-server.js` |
| 3035 | JWT Attack Lab | `attack-guide-server.js` |
| 3036 | Protected AuthVault | `victim-server-protected.js` |

---

## Attack Flow

```
Attack 1 — alg:none
  Valid token header: { "alg": "HS256", "typ": "JWT" }
  Attacker modifies: { "alg": "none",  "typ": "JWT" } + strips signature
        ↓
  AuthVault (3034): jwt.verify() reads alg FROM the token → skips HMAC check
        ↓
  Forged token accepted. role set to "admin". No secret needed.

Attack 2 — weak secret brute-force
  Attacker runs: HMAC-SHA256(header.payload, "secret") → matches token signature
        ↓
  Signs new token with role:"admin" using "secret"
        ↓
  Server accepts — valid signature, just forged payload
```

---

## How to Run

```bash
cd demo-attacked/jwt-attacks
npm install
```

Three terminals:

```
npm run vulnerable           # :3034
npm run guide                # :3035
npm run secure               # :3036
```

---

## Attack Walkthrough

### alg:none

1. Open **localhost:3035**
2. Click **Login → :3034** (alice / hunter2)
3. Click **⚡ Forge alg:none Token** — role set to admin
4. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
5. Click **Test on Protected :3036** — `✗ Rejected`

### Weak Secret

1. With alice's token in the token field
2. Click **⚡ Crack HS256 Secret**
3. In ~40 tries it finds `"secret"`
4. A re-signed admin token appears automatically
5. Click **Test on Vulnerable :3034** — `🚨 ADMIN ACCESS GRANTED`
6. Click **Test on Protected :3036** — `✗ Rejected` (different, unguessable secret)

---

## Protected Demo

Steps 5 and 6 in each walkthrough above test the protected server at **localhost:3036** — forged tokens are rejected.

---

## Vulnerable Lines

```js
// ⚠️ Trusts the alg field from the token header — alg:none skips HMAC check
if (header.alg === 'none') {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  req.user = payload;
  return next();
}

// ⚠️ Weak secret — in every JWT wordlist; forge any payload once cracked
const JWT_SECRET = 'secret';
```

---

## The Fix

```js
// ✅ Never read alg from the token — whitelist it here
jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

// ✅ Strong secret — load from process.env.JWT_SECRET in production
const JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
```

---

## Why It Works

AuthVault (3034): `jwt.verify()` reads `alg` FROM the token → skips HMAC check. Forged token accepted. role set to `"admin"`. No secret needed.

Attacker runs: `HMAC-SHA256(header.payload, "secret")` → matches token signature. Signs new token with `role:"admin"` using `"secret"`. Server accepts — valid signature, just forged payload.

---

## Logout — JWT Revocation Demo

1. Log in at **localhost:3034** → copy the token → click **Sign Out**
2. Go to the attack guide (3035) → paste the old token in Step 0 → click **Test Revoked Token on :3034** → `✓ Token rejected: "Token has been revoked"`
3. Restart the `:3034` server (`Ctrl+C`, `npm run vulnerable`) → test again → token accepted again
4. This demonstrates: **in-memory denylists are not persistent** — production requires Redis or a database.

---

## Why jwt.decode() is dangerous

`jwt.decode()` in the `jsonwebtoken` package decodes a JWT without verifying
the signature. It should only be used AFTER `jwt.verify()` — never as a
replacement. Using `jwt.decode()` for authorization is equivalent to having no
auth at all.

---

## Credentials

| User | Password | Role |
|------|----------|------|
| alice | hunter2 | developer |
| bob | correct-horse | developer |
| admin | Adm1nS3cr3t! | admin |
