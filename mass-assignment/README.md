# Mass Assignment Attack Demo — ProfileHub

## Port Reference

| Port | Role | File |
|------|------|------|
| 3046 | Vulnerable ProfileHub | `victim-server.js` |
| 3047 | Attack guide | `attack-guide-server.js` |
| 3048 | Protected ProfileHub | `victim-protected-server.js` |

---

## Attack Flow

```
Attacker sends: PATCH /api/profile
  { "bio": "hello", "isAdmin": true, "plan": "admin" }
        ↓
ProfileHub (3046): Object.assign(req.user, req.body)
        ↓
req.user.isAdmin = true  ←  merged from request body without filtering
        ↓
Attacker now has admin access. Admin panel unlocks. All user records visible.
No password change. No privilege escalation UI. Just one HTTP request.
```

---

## How to Run

```bash
cd demo-attacked/mass-assignment
npm install
```

Three terminals:

```
npm run vulnerable           # :3046
npm run guide                # :3047
npm run secure               # :3048
```

---

## Attack Walkthrough

1. Open **localhost:3047** and log in as `alice` / `alice123`
2. Click **GET /api/me** — confirm `isAdmin: false`
3. Send PATCH with `{"bio": "test", "isAdmin": true, "isPremium": true, "plan": "admin"}`
4. Response shows `"isAdmin": true` — privilege escalated
5. Click **GET /api/admin/users** — now returns all users

---

## Protected Demo

1. Switch to **:3048** — same attack has no effect; admin endpoint still returns 403

---

## Vulnerable Lines

```js
// ⚠️ Blind merge — isAdmin, isPremium, plan are all writable by the client
Object.assign(req.user, req.body);
```

---

## The Fix

```js
// ✅ Explicit allowlist — only safe profile fields can be updated
const ALLOWED_PROFILE_FIELDS = ['bio', 'jobTitle', 'company', 'email'];
const update = {};
ALLOWED_PROFILE_FIELDS.forEach(function (field) {
  if (Object.prototype.hasOwnProperty.call(req.body, field)) {
    update[field] = req.body[field];
  }
});
Object.assign(req.user, update);
```

---

## Why It Works

`Object.assign(existingRecord, req.body)` blindly merges every field in the HTTP request body into the user object. If the user model has an `isAdmin` field and the developer forgot to exclude it, any authenticated user can escalate to admin by including `"isAdmin": true` in any profile update.

---

## Defense Details

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
