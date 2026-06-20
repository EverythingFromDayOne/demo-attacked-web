# Cursor Prompt: SSRF Attack Demo — DevShare Link Preview

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018).
This demo lives under `demo-attacked/ssrf/` using ports 3018–3021.
Note: port 3018 is shared with the reverse-tabnabbing protected server — do not run both demos simultaneously.

Tech stack: Node.js + Express. Vanilla CSS/JS.

**Serving architecture:** All HTML lives in static files under a `public/` subfolder. Victim and
protected servers use `res.sendFile(path.join(__dirname, 'public', 'index.html'))` for `GET /`
and expose `GET /api/config → { mode, port }` for dynamic banner rendering.
`internal-server.js` serves `res.sendFile(path.join(__dirname, 'public', 'internal.html'))`.
No inline HTML template literals in server files.

---

## Global UI Standard — applies to every server in this lab

| Server type | Theme |
|-------------|-------|
| Attack guide (`attack-guide-server.js`, port 3018) | Dark terminal aesthetic — exact CSS below. HTML lives in `public/guide.html`, served via `res.sendFile`. |
| Internal API server (`internal-server.js`, port 3020) | Muted corporate — `#1a1a2e` bg, `#e2e8f0` text, `#334155` borders, amber (`#fbbf24`) warning line only. This is the SSRF *target*, not an attacker tool — see its detailed spec below. |
| Victim servers | Realistic product UI matching their brand (DevShare) |

**Attack guide page — exact CSS (use these values, do not paraphrase):**
```css
body {
  background: #0a0a0a;
  color: #00ff41;
  font-family: 'Courier New', Courier, monospace;
  padding: 2rem;
  margin: 0;
}
.flow-box {
  background: #0d1a0d;
  border: 1px solid #1a3a1a;
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.credentials-panel {
  background: #050f05;
  border: 1px solid #1a3a1a;
  border-radius: 6px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
```
The guide page should walk through the attack flow diagram, show the internal
endpoint list with copy buttons, and provide the fixed bottom-left
`target-switcher` (Vulnerable :3019 / Protected :3021) — no other open/link
buttons anywhere on the page.

---

## Code Comment Standard — educational depth, not one-liners

Comments are teaching material, not labels. Each comment must answer: what is
wrong/fixed, why it is exploitable/safe, how the attack works mechanically, and
any nuance a student would miss without running the demo.

**Required nuance for SSRF:** on `fetch(url)`, explain that the server makes the
HTTP request from its own network position — bypassing any firewall or network
boundary that blocks the browser from reaching internal-only addresses directly.
Name the real-world target explicitly: the AWS EC2 metadata endpoint
(`169.254.169.254`) returns IAM credentials for the instance's role with zero
authentication, reachable from the server but never from a user's browser. This
is the single most damaging real-world SSRF target and should be named in the
comment, not just alluded to.

---

## Files to create

```
demo-attacked/ssrf/
├── victim-server.js            # DevShare vulnerable     — port 3019
├── victim-server-protected.js  # DevShare protected      — port 3021
├── internal-server.js          # Internal API + UI       — port 3020
├── attack-guide-server.js      # Attack guide            — port 3018
├── public/
│   ├── index.html              # DevShare UI (shared by victim + protected)
│   ├── internal.html           # Internal server UI (no banner — it's the target, not a demo server)
│   └── guide.html              # Attack guide UI
├── package.json
├── .gitignore
└── README.md
```

---

## .gitignore

```
node_modules/
.env
*.log
```

---

## Package.json scripts

```json
{
  "scripts": {
    "vulnerable":  "node victim-server.js",
    "internal":    "node internal-server.js",
    "guide":       "node attack-guide-server.js",
    "secure":      "node victim-server-protected.js"
  }
}
```

Dependencies: `express`, `cors`, `node-fetch` (or use native `fetch` — Node 18+).

---

## DevShare App (victim-server.js — port 3019)

### Concept

A developer link-sharing platform. The core feature is URL preview: the user
pastes any URL and the server fetches the page, extracts `<title>` and
`<meta name="description">`, and returns a preview card.

This is a common, legitimate feature (Slack, Discord, Linear all do this).
The vulnerability is that the server performs the fetch without validating
whether the URL points to a public or internal address.

### Session

No authentication needed. Set a passive identifier cookie on first visit:
```
name:     devshare_session
value:    DevUser_demo_TOKEN_999
httpOnly: false
path:     /
```

### Visual design

Clean developer-tool aesthetic. Dark navy sidebar, white main panel,
blue-purple accent (`#6366f1`). Logo: "DevShare </> — Developer Link Hub".

Header: logo, nav (Feed, Bookmarks, Collections, Trending), user avatar "D".

Demo banner at top — color and text determined by `/api/config` on `DOMContentLoaded`:
- Vulnerable: orange `⚠️ VULNERABLE: URL preview fetches any URL server-side — no private address validation`
- Protected: green `✅ PROTECTED: Private IP ranges blocked — SSRF prevented`

**GET /api/config** — returns `{ mode: 'vulnerable', port: 3019 }` (victim) or `{ mode: 'protected', port: 3021 }` (protected).
**GET /** — `res.sendFile(path.join(__dirname, 'public', 'index.html'))`

### Main page layout

Two panels:

**Left panel — recent shared links (4 pre-seeded entries):**
- "V8 Engine Deep Dive" — v8.dev
- "TC39 Proposals Tracker" — tc39.es
- "Node.js Performance Docs" — nodejs.org
- "Rust for JS Developers" — rustforjs.dev

Each shows a preview card: title, truncated description, favicon placeholder, domain badge.

**Right panel — "Add a Link" form:**
- Large label: "Paste any URL to generate a preview"
- Text input: placeholder `https://example.com`
- Button: "Generate Preview →" (indigo)
- Result area below the form: empty by default, fills after submission

### URL preview flow

On form submit: `POST /api/preview` with `{ url }`.

Server handler (the vulnerable code):

```js
app.post('/api/preview', async (req, res) => {
  const { url } = req.body;

  // ⚠️ VULNERABILITY: No URL validation. The server blindly fetches whatever
  //    URL the user supplies. If the URL points to an internal service
  //    (localhost, 10.x.x.x, 169.254.169.254, etc.), the server will fetch it
  //    and return the response — the browser cannot reach these addresses
  //    directly, but the server can.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await response.text();

    // Parse title and description from HTML (or return raw body if JSON)
    const title = body.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
      || url;
    const desc = body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
      || (body.startsWith('{') ? body.slice(0, 500) : 'No description found');

    res.json({ success: true, title, description: desc, url,
               status: response.status, contentType: response.headers.get('content-type') });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
```

**Important:** If the fetched URL returns JSON (which the internal API does),
the raw JSON body should be shown in the description field — this makes the
exfiltrated data immediately visible in the UI. Detect `content-type:
application/json` and render it in a `<pre>` block instead of plain text.

Result card displays:
- Title
- Description (or raw JSON body in `<pre>` if JSON)
- Target URL
- HTTP status code returned from the fetch
- Content-Type header returned
- A small ⚠️ label if the HTTP status was not 200

---

## Internal API Server (internal-server.js — port 3020)

### Concept

Simulates a private internal microservice — the kind that lives inside a
VPC or Docker network, reachable by other backend services but never by
the public internet. This is the SSRF **target**, not the attacker's tool.

Port 3020 should feel like bland, boring enterprise internal tooling. Think:
a developer stumbled onto an internal admin page by accident after getting
inside the network. No hacker aesthetic. No attack instructions. The page
should feel like something that was never designed to be seen by an outsider.

### Internal API routes (all return JSON with `Content-Type: application/json`)

#### GET /internal
```json
{
  "service": "internal-admin-api",
  "version": "2.1.4",
  "environment": "production",
  "note": "THIS SERVICE SHOULD NOT BE PUBLICLY ACCESSIBLE",
  "endpoints": [
    "/internal/env",
    "/internal/users",
    "/internal/config",
    "/internal/health"
  ]
}
```

#### GET /internal/env
Returns fake but realistic-looking environment variables:
```json
{
  "NODE_ENV": "production",
  "DATABASE_URL": "postgresql://admin:Sup3rS3cr3tPwd!@db.internal:5432/devshare_prod",
  "REDIS_URL": "redis://:RedisPass2024@cache.internal:6379/0",
  "JWT_SECRET": "f9a3b2c1d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1",
  "AWS_ACCESS_KEY_ID": "AKIAIOSFODNN7EXAMPLE",
  "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "STRIPE_SECRET_KEY": "sk_test_EXAMPLE_REPLACE_FOR_REAL_DEMO",
  "SENDGRID_API_KEY": "SG.FakeKeyDemo.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "ADMIN_PASSWORD": "DevShareAdmin2024!",
  "ENCRYPTION_KEY": "aes-256-cbc:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
}
```

#### GET /internal/users
```json
{
  "total": 3,
  "users": [
    { "id": 1, "email": "admin@devshare.io", "role": "superadmin",
      "password_hash": "$2b$10$FakeHashAdminXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "created_at": "2024-01-15T09:00:00Z" },
    { "id": 2, "email": "sarah.chen@devshare.io", "role": "admin",
      "password_hash": "$2b$10$FakeHashSarahXXXXXXXXXXXXXXXXXXXXXXXXX",
      "created_at": "2024-03-22T14:30:00Z" },
    { "id": 3, "email": "dev-bot@devshare.io", "role": "service_account",
      "api_key": "ds_live_serviceaccount_k8s_FAKEKEY12345",
      "created_at": "2024-06-01T08:00:00Z" }
  ]
}
```

#### GET /internal/config
```json
{
  "database": {
    "primary": "db-primary.internal:5432",
    "replica": "db-replica.internal:5432",
    "pool_size": 20
  },
  "cache": { "host": "cache.internal", "port": 6379, "ttl": 3600 },
  "storage": { "bucket": "devshare-prod-assets", "region": "us-east-1" },
  "feature_flags": { "admin_panel": true, "beta_export": false },
  "rate_limits": { "public_api": 100, "internal_api": 10000 }
}
```

#### GET /internal/health
```json
{
  "status": "healthy",
  "uptime_seconds": 1209600,
  "db_connection": "postgresql://admin:Sup3rS3cr3tPwd!@db.internal:5432/devshare_prod",
  "redis_connection": "redis://:RedisPass2024@cache.internal:6379/0",
  "checks": { "database": "ok", "cache": "ok", "storage": "ok" }
}
```

### Root page (GET /) — Internal service registry

**NOT a hacker terminal. NOT an attack console.** Design as bland enterprise internal tooling.

#### Header / identity

```
DevShare Platform — Internal Services
devshare-internal.corp  ·  NOT FOR PUBLIC ACCESS
```

Small monospace font. Muted color palette — `#1a1a2e` background, `#e2e8f0` text,
`#334155` borders. No neon. No green terminal glow.

One subdued banner below the header:

```
⚠  This service has no authentication — it assumes network-level isolation.
   Access from outside the internal network means your perimeter is broken.
```

Style: amber/yellow text (`#fbbf24`), no background box — just a single line.

#### Service registry table

Title: `Internal Endpoints`

A simple HTML table. No copy buttons — just a clean list:

| Path | Description | Response |
|------|-------------|----------|
| `/internal` | Service discovery | JSON |
| `/internal/env` | Runtime environment & secrets | JSON |
| `/internal/users` | User database snapshot | JSON |
| `/internal/config` | Infrastructure configuration | JSON |
| `/internal/health` | DB / Redis connection strings | JSON |

Plain table styling. Alternating row shading. No action buttons.

Below the table, a muted note in small text:

```
These endpoints return live data. No auth required — access control is
handled at the network layer (VPC security groups / firewall rules).
```

#### Demo context callout

A `<details>` element (closed by default), labeled:

```
▶ Demo context — why this page is reachable
```

When expanded:

```
In production, port 3020 would be on a private subnet unreachable from
your browser. This demo runs everything on localhost so you can see the
internal API directly — but that's not how SSRF works in the real attack.

In the real attack:
  Your browser cannot reach http://localhost:3020/internal/env
  DevShare's server (port 3019) CAN reach it — same machine, same network
  You trick DevShare into fetching it for you via the URL preview feature
  DevShare returns the response to your browser

That's Server-Side Request Forgery: you forged a request the server made.

To run the attack:
  1. Open http://localhost:3019 (vulnerable DevShare)
  2. Paste any /internal/* URL into the preview field
  3. Click Generate Preview
  4. Read the secrets in the preview card
```

#### Demo controls (bottom of page)

A horizontal rule, then a small section labeled `Demo Controls` in muted text.

Two small secondary buttons only:
- `Vulnerable DevShare :3019` — opens `http://localhost:3019` in new tab
- `Protected DevShare :3021` — opens `http://localhost:3021` in new tab

Style: `border: 1px solid #475569`, `background: transparent`, `color: #94a3b8`. Not prominent.

No copy buttons. No "paste this URL" instructions.

---

## Protected Server (victim-server-protected.js — port 3021)

Identical DevShare UI with these changes:

**Green demo banner:**
`✅ PROTECTED: URL validation blocks private addresses, loopback, and non-HTTP schemes`

**URL validation middleware** (applied before the fetch):

```js
function isUrlSafe(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // ✅ PROTECTED: Only allow http and https. Blocks file://, gopher://, dict://,
  //    ftp://, and other schemes that could be used for SSRF or local file read.
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: `Scheme "${parsed.protocol}" not allowed — only http/https` };
  }

  const host = parsed.hostname.toLowerCase();

  // ✅ PROTECTED: Block loopback addresses (all representations of 127.0.0.1 / ::1)
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'].includes(host)) {
    return { safe: false, reason: 'Private/loopback address blocked' };
  }

  // ✅ PROTECTED: Block AWS EC2 instance metadata endpoint
  if (host === '169.254.169.254') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ PROTECTED: Block GCP metadata endpoint
  if (host === 'metadata.google.internal') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ PROTECTED: Block RFC-1918 private IP ranges
  const octets = host.split('.').map(Number);
  if (octets.length === 4 && octets.every(n => !isNaN(n))) {
    if (octets[0] === 10) {
      return { safe: false, reason: 'Private IP range 10.0.0.0/8 blocked' };
    }
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { safe: false, reason: 'Private IP range 172.16.0.0/12 blocked' };
    }
    if (octets[0] === 192 && octets[1] === 168) {
      return { safe: false, reason: 'Private IP range 192.168.0.0/16 blocked' };
    }
  }

  return { safe: true };
}
```

In the `POST /api/preview` handler, call `isUrlSafe(url)` before fetching.
If not safe, return:
```json
{ "success": false, "blocked": true, "reason": "..." }
```

And render a red blocked banner in the UI:
`"⛔ Blocked: [reason from validation]"`

---

## README.md

### Canonical structure (required — write directly in this order)

Write `README.md` directly in this order, `---` between every top-level section:

```
# SSRF Attack Demo — DevShare Link Preview

## Port Reference
## Attack Flow
## How to Run
## Attack Walkthrough
## Protected Demo
## Vulnerable Lines
## The Fix
## Why It Works
## Defense Details
[optional: Why This Attack Is Dangerous, Why the Denylist Is Insufficient — DNS Rebinding,
 Internal API Endpoints]
```

Note the Port Reference table needs all 4 servers (3018 guide, 3019 vulnerable,
3020 internal, 3021 protected) and a callout that port 3018 conflicts with
reverse-tabnabbing's protected server. Rename mapping: "Vulnerable code (exact)"
→ `## Vulnerable Lines`. "Defense details" stays `## Defense Details`. "Mental
model — who is the attacker?" merges into `## Why It Works`. The attack
walkthrough below splits into `## How to Run` (steps 1–4, starting all servers)
and `## Attack Walkthrough` (steps 5–8); "Protected demo" becomes its own
`## Protected Demo` section. No `## Credentials` — no login form in this demo.

---

### Attack Flow

```
Attacker browser ——tells——→ DevShare (3019) ——fetches——→ Internal API (3020)
                                    ↓
                      returns internal data back to browser

The browser cannot reach 3020 directly (it's "internal").
The server can. DevShare becomes an unintentional proxy into its own network.

Real-world target: http://169.254.169.254/ → AWS IAM credentials
```

### Port Reference

| Port | Role | File |
|------|------|------|
| 3018 | Attack guide | `attack-guide-server.js` |
| 3019 | Vulnerable victim (DevShare) | `victim-server.js` |
| 3020 | Internal API (simulated private service) | `internal-server.js` |
| 3021 | Protected victim (DevShare) | `victim-server-protected.js` |

> ⚠️ Port 3018 conflicts with reverse-tabnabbing's protected server — never run both demos simultaneously.

### Attack walkthrough

1. `cd demo-attacked/ssrf && npm install`
2. Terminal 1: `npm run vulnerable` → DevShare at **localhost:3019**
3. Terminal 2: `npm run internal` → Internal API at **localhost:3020**
4. Terminal 3: `npm run guide` → Attack guide at **localhost:3018**
5. Open **localhost:3020** — note this is the internal SSRF target, not an attack tool.
6. Copy `http://localhost:3020/internal/env`.
7. Open **localhost:3019**, paste the URL into the preview form, click "Generate Preview".
8. The DevShare server fetches the internal API and returns your fake database
   password, JWT secret, and AWS keys in the preview card.
9. Try `http://localhost:3020/internal/users` — you get the entire user table.

### Protected demo

1. Terminal 3: `npm run secure` → protected DevShare at **localhost:3021**
2. Paste the same `http://localhost:3020/internal/env` URL.
3. Result: `"⛔ Blocked: Private/loopback address blocked"`

### Mental model — who is the attacker?

```
Attacker browser → [public internet] → DevShare server (3019)
                                              ↓ (internal network)
                                       Internal API (3020) ← never supposed to be reachable
```

Port 3020 is the **target** — it simulates `169.254.169.254` or `db.internal`.
Port 3019 is the **victim server** that makes the request on the attacker's behalf.
The browser (attacker) cannot reach 3020 directly — but it tricks 3019 into doing it.

### Why this attack is dangerous

Real-world SSRF targets:
- **AWS EC2 metadata** (`169.254.169.254`) — returns IAM credentials. Full cloud account takeover in one HTTP request.
- **GCP/Azure metadata** — same pattern, different URL.
- **Elasticsearch** (`localhost:9200`) — unauthenticated by default in older versions.
- **Redis** (`localhost:6379`) — writable via HTTP in older configs.
- **Internal Kubernetes API** (`10.x.x.x`) — cluster management.
- **CI/CD secrets** — Jenkins at `localhost:8080`, Vault at `localhost:8200`.

### Why the denylist is insufficient — DNS rebinding

The protected server checks the URL's **hostname** before fetching. An attacker can bypass with DNS rebinding:

1. Register `ssrf.attacker.com` with a short TTL (e.g. 10 seconds).
2. First DNS query returns a legitimate public IP — passes the denylist check.
3. TTL expires. DNS record updated to point to `127.0.0.1`.
4. Server performs the actual fetch — DNS now resolves to loopback.
5. Server fetches `http://127.0.0.1/internal/env` — denylist was bypassed.

**Robust fix:** resolve hostname to IP first, validate the IP, then fetch to that IP (not the hostname). This is TOCTOU-safe SSRF prevention. Libraries like `ssrf-req-filter` implement this correctly.

### Vulnerable code (exact)

`victim-server.js` — the `POST /api/preview` handler:

```js
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

The vulnerability is the absence of URL validation before this call.

### Defense details

1. **Scheme allowlist** — only `http:` and `https:`. Blocks `file://`, `gopher://`, `dict://`.
2. **Hostname denylist** — blocks loopback, link-local, and RFC-1918 private ranges.
3. **DNS resolution check** (not implemented here, but correct approach) — resolve hostname to IP before fetching, validate the IP, fetch to the IP. Prevents DNS rebinding.
4. **Response size limit** — cap response bytes to prevent reading huge files if SSRF is partially achieved.
5. **Internal network segmentation** — internal services should not be reachable from application servers at all. Use VPC security groups, firewalls, or service mesh policies — defense in depth.

### Code comment style (match existing demos)

```
// ⚠️ VULNERABILITY: <what and why>
// ✅ PROTECTED: <what was changed and why it works>
```
