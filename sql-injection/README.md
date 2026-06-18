# SQL Injection Attack Demo — DevLinks

## Port Reference

| Port | Role | File |
|------|------|------|
| 3025 | Vulnerable DevLinks | `victim-server.js` |
| 3026 | Attack guide | `attack-guide-server.js` |
| 3027 | Protected DevLinks | `victim-server-protected.js` |

---

## Attack Flow

```
Attacker sends: GET /api/search?q=' UNION SELECT id,username,password FROM users--
        ↓
DevLinks (3025) builds query by string concatenation:
  SELECT * FROM links WHERE title LIKE '%[INPUT]%'
  → SELECT * FROM links WHERE title LIKE '%' UNION SELECT id,username,password FROM users--%'
        ↓
Database executes both SELECT statements
        ↓
All usernames + hashed passwords returned in search results
```

---

## How to Run

```bash
cd demo-attacked/sql-injection
npm install   # installs better-sqlite3 (compiles native bindings — takes ~30s)
```

Three terminals:

```
npm run vulnerable           # :3025
npm run guide                # :3026
npm run secure               # :3027
```

---

## Attack Walkthrough

### Data Extraction

1. Open **localhost:3025**
2. Search for `javascript` — see normal results
3. Search for `' UNION SELECT id,username,password,email,'' FROM users--`
4. Results now include rows from the `users` table — usernames and passwords visible in the result cards

The original query selects 5 columns; the UNION payload must also return 5 columns (the empty string `''` fills the fifth).

### Login Bypass

1. Open **localhost:3025/admin**
2. Username: `admin'--`  Password: `anything`
3. Click Sign In
4. Admin dashboard loads — full user database displayed

---

## Protected Demo

1. Open **localhost:3027**
2. Try the same UNION search payload — returns only legitimate resource matches (injection treated as literal search text)
3. Try `admin'--` on admin login — fails (`Invalid credentials`)

---

## Vulnerable Lines

```js
// ⚠️ String concatenation — ' UNION SELECT id,username,password,email,'' FROM users--
db.prepare(
  'SELECT id, title, url, tags, author FROM resources WHERE title LIKE \'%' + q + '%\' OR tags LIKE \'%' + q + '%\''
).all();

// ⚠️ Login bypass — admin'-- comments out the password check
db.prepare(
  'SELECT * FROM users WHERE username = \'' + username + '\' AND password = \'' + password + '\''
).get();
```

---

## The Fix

```js
// ✅ Parameterized queries — user input is always data, never SQL syntax
db.prepare('SELECT ... WHERE title LIKE ? OR tags LIKE ?').all(`%${q}%`, `%${q}%`);
db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
```

---

## Why It Works

Database executes both SELECT statements. All usernames + hashed passwords returned in search results.

---

## Defense Details

**Parameterized queries** are the complete defense. The separation of structure and data is enforced by the driver, not the developer's escaping.

**What does NOT work:**

- Manual escaping (replacing `'` with `''`) — fragile and incomplete
- Allowlist validation — fragile for search fields where users search for special characters
- ORMs are safe by default, but raw query escape hatches (`.query()`, `.raw()`) re-introduce the vulnerability

With parameterized queries, the structure is compiled first:

```
SELECT ... WHERE title LIKE ? OR tags LIKE ?
```

Then the runtime binds `%javascript%` to each `?`. A UNION keyword inside a parameter value is not SQL syntax — it's just characters.

---

## Why Parameterized Queries Work

The vulnerability exists because string interpolation happens before SQLite's parser sees the query. By the time SQLite reads `... LIKE '%' UNION SELECT...`, it cannot distinguish the original SQL from the injected SQL.

With parameterized queries, the structure is compiled first:

```
SELECT ... WHERE title LIKE ? OR tags LIKE ?
```

Then the runtime binds `%javascript%` to each `?`. A UNION keyword inside a parameter value is not SQL syntax — it's just characters.

---

## SQL vs NoSQL Injection

| | SQL Injection | NoSQL Operator Injection |
|---|---|---|
| Database | Relational (SQLite, Postgres, MySQL) | Document (MongoDB) |
| Attack vector | String concatenated into SQL query | Object field passed as query parameter |
| Input format required | Any (string) | JSON (nested object) |
| Injected payload | SQL keywords: `OR`, `UNION`, `--`, `;` | MongoDB operators: `$gt`, `$ne`, `$regex` |
| Defense | Parameterized queries / prepared statements | Type validation (enforce string input) |
| What can be extracted | Any table, any column the DB user can access | Any document the query can match |
| Login bypass payload | `admin'--` or `' OR 1=1--` | `{ "password": { "$gt": "" } }` |
