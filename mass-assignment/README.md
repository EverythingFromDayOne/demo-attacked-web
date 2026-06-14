# Mass Assignment Attack Demo — ProfileHub

## Port Reference

| Port | Role | File |
|------|------|------|
| 3046 | Vulnerable ProfileHub | `victim-server.js` |
| 3047 | Attack guide | `attack-guide-server.js` |
| 3048 | Protected ProfileHub | `victim-protected-server.js` |

---

## What this demonstrates

`Object.assign(existingRecord, req.body)` blindly merges every field in the HTTP request body into the user object. If the user model has an `isAdmin` field and the developer forgot to exclude it, any authenticated user can escalate to admin by including `"isAdmin": true` in any profile update.

---

## Vulnerable line

```js
Object.assign(req.user, req.body); // ← no field filtering
```

---

## The fix

```js
const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];
const update = {};
for (const field of ALLOWED_PROFILE_FIELDS) {
  if (Object.prototype.hasOwnProperty.call(req.body, field)) update[field] = req.body[field];
}
Object.assign(req.user, update);
```

---

## Run the demo

```bash
cd demo-attacked/mass-assignment
npm install
npm run victim           # terminal 1 → localhost:3046
npm run attacker         # terminal 2 → localhost:3047
npm run victim-protected # terminal 3 → localhost:3048
```

### Walkthrough

1. Open **localhost:3047** and log in as `alice` / `alice123`
2. Click **GET /api/me** — confirm `isAdmin: false`
3. Send PATCH with `{"bio": "test", "isAdmin": true, "isPremium": true, "plan": "admin"}`
4. Response shows `"isAdmin": true` — privilege escalated
5. Click **GET /api/admin/users** — now returns all users
6. Switch to **:3048** — same attack has no effect; admin endpoint still returns 403

---

## Key technical notes

**Two layers of defense in the protected version:**

1. Allowlist on write — `isAdmin` can never be set via PATCH
2. Strip from read — `publicUser()` never returns `isAdmin` in the API response

**Real-world variants:** Rails (`params[:user]`), Mongoose (`findByIdAndUpdate(id, req.body)`), Django REST Framework (`fields = '__all__'`). The pattern is universal across languages and ORMs.

---

## Credentials

| User | Password |
|------|----------|
| alice | alice123 |
| bob | bob123 |
| charlie | charlie123 |
| admin | admin123 |

Use `POST /api/reset` on either victim server to reset demo state between runs.
