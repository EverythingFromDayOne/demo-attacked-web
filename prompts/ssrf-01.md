# Cursor Prompt: SSRF Attack Demo — DevShare Link Preview

## Context

Part of the security attack demonstration lab at
https://github.com/EverythingFromDayOne/demo-attacked-web.
Previous demos: XSS (3001–3009), CSRF (3010–3012), Clickjacking (3013–3015),
Reverse Tabnabbing (3016–3018).
This demo lives under `demo-attacked/ssrf/` using ports 3019–3021.

Tech stack: Node.js + Express. All HTML as template literals. Vanilla CSS/JS.

---

## Files to create

```
demo-attacked/ssrf/
├── victim-server.js            # DevShare vulnerable     — port 3019
├── victim-server-protected.js  # DevShare protected      — port 3021
├── internal-server.js          # Internal API + console  — port 3020
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

```
victim            → node victim-server.js
internal          → node internal-server.js
victim-protected  → node victim-server-protected.js
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

Orange demo banner at top:
`⚠️ VULNERABLE: URL preview fetches any URL server-side — no private address validation`

### Main page layout

Two panels:

**Left panel — recent shared links (4 pre-seeded entries):**
- "V8 Engine Deep Dive" — v8.dev
- "TC39 Proposals Tracker" — tc39.es
- "Node.js Performance Docs" — nodejs.org
- "Rust for JS Developers" — rustforjs.dev

Each shows a preview card: title, truncated description, favicon placeholder,
domain badge.

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
the public internet. This is the SSRF target.

It also serves an SSRF attack console at `GET /` so the demo viewer can
easily copy target URLs and switch between victim servers.

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

### SSRF Attack Console (GET /)

Dark terminal aesthetic, matching other attacker dashboards in the lab.

Title: "SSRF Attack Console — Internal API"

**Section 1 — Available internal endpoints to probe:**

Table listing the 4 internal endpoints with a "Copy" button next to each URL:
```
http://localhost:3020/internal          ← service discovery
http://localhost:3020/internal/env      ← credentials & secrets
http://localhost:3020/internal/users    ← user database dump
http://localhost:3020/internal/config   ← infrastructure config
http://localhost:3020/internal/health   ← db/redis connection strings
```

Plus two bonus entries for real-world awareness:
```
http://169.254.169.254/latest/meta-data/iam/security-credentials/  ← AWS metadata (EC2 only)
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token  ← GCP metadata
```
Mark the AWS/GCP entries with a note: "(only works on cloud VMs — included for
real-world awareness)".

**Section 2 — How to use:**

Numbered steps:
1. Start the vulnerable DevShare server: `npm run victim`
2. Open `http://localhost:3019`
3. Paste one of the URLs above into the preview form
4. The server fetches the internal URL and returns its contents to your browser

**Section 3 — Victim switcher (bottom-left, same as all other attacker pages):**
- `Vulnerable (:3019)` — dark button, opens localhost:3019 in new tab
- `Protected (:3021)` — red button, opens localhost:3021 in new tab

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

  // ✅ FIX: Only allow http and https. Blocks file://, gopher://, dict://,
  //    ftp://, and other schemes that could be used for SSRF or local file read.
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: `Scheme "${parsed.protocol}" not allowed — only http/https` };
  }

  const host = parsed.hostname.toLowerCase();

  // ✅ FIX: Block loopback addresses (all representations of 127.0.0.1 / ::1)
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'].includes(host)) {
    return { safe: false, reason: 'Private/loopback address blocked' };
  }

  // ✅ FIX: Block AWS EC2 instance metadata endpoint
  if (host === '169.254.169.254') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ FIX: Block GCP metadata endpoint
  if (host === 'metadata.google.internal') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ FIX: Block RFC-1918 private IP ranges
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

### Port Reference

| Port | Role | File |
|------|------|------|
| 3019 | Vulnerable victim (DevShare) | `victim-server.js` |
| 3020 | Internal API + attack console | `internal-server.js` |
| 3021 | Protected victim (DevShare) | `victim-server-protected.js` |

### Attack walkthrough

1. `cd demo-attacked/ssrf && npm install`
2. Terminal 1: `npm run victim` → DevShare at **localhost:3019**
3. Terminal 2: `npm run internal` → Internal API at **localhost:3020**
4. Open **localhost:3020** — you see the attack console with available endpoints.
5. Copy `http://localhost:3020/internal/env`.
6. Open **localhost:3019**, paste the URL into the preview form, click "Generate Preview".
7. The DevShare server fetches the internal API and returns your fake database
   password, JWT secret, and AWS keys in the preview card.
8. Try `http://localhost:3020/internal/users` — you get the entire user table.

### Protected demo

1. Terminal 3: `npm run victim-protected` → protected DevShare at **localhost:3021**
2. Paste the same `http://localhost:3020/internal/env` URL.
3. Result: `"⛔ Blocked: Private/loopback address blocked"`

### Why this attack is dangerous

The browser can only reach public internet addresses. The server lives
inside the same network as databases, caches, admin APIs, and cloud
infrastructure. SSRF turns the server into an **unintentional proxy**:

```
Attacker browser → [public internet] → DevShare server (3019)
                                              ↓ (internal network)
                                       Internal API (3020) ← never supposed to be reachable
```

Real-world SSRF targets:
- **AWS EC2 metadata** (`169.254.169.254`) — returns IAM credentials for the
  instance's role. Full cloud account takeover in one HTTP request.
- **GCP/Azure metadata** — same pattern, different URL.
- **Elasticsearch** (`localhost:9200`) — unauthenticated by default in older
  versions. `GET /_cat/indices` lists all data.
- **Redis** (`localhost:6379`) — writable via HTTP in older configs.
- **Internal Kubernetes API** (`10.x.x.x`) — cluster management.
- **CI/CD secrets** — Jenkins at `localhost:8080`, Vault at `localhost:8200`.

### Why the denylist is insufficient — DNS rebinding

The protected server checks the URL's **hostname** before fetching. An
attacker can bypass this with DNS rebinding:

1. Register `ssrf.attacker.com` with a short TTL (e.g. 10 seconds).
2. First DNS query returns a legitimate public IP — passes the denylist check.
3. TTL expires. DNS record updated to point to `127.0.0.1`.
4. Server performs the actual fetch — DNS now resolves to loopback.
5. Server fetches `http://127.0.0.1/internal/env` — denylist was bypassed.

**Robust fix:** resolve the hostname to an IP address first, validate the
resulting IP, and then immediately open a connection to that IP (not the
hostname) — so the same DNS resolution is used for both the check and the
fetch. This is called **TOCTOU-safe SSRF prevention** (Time-Of-Check
Time-Of-Use). Libraries like `ssrf-req-filter` implement this correctly.

The demo uses the simpler denylist approach because DNS rebinding cannot
be demonstrated locally. The README documents this limitation explicitly.

### Vulnerable code (exact)

`victim-server.js` — the `POST /api/preview` handler:

```js
const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

The single line of vulnerability is the absence of URL validation before
this call. `fetch(url)` with user-supplied `url` and no checks is SSRF.

### Defense details

1. **Scheme allowlist** — only `http:` and `https:`. Blocks `file://`,
   `gopher://`, `dict://`, and other dangerous schemes.
2. **Hostname denylist** — blocks loopback (`127.x.x.x`, `::1`, `localhost`),
   link-local (`169.254.0.0/16`), and RFC-1918 private ranges.
3. **DNS resolution check** (not implemented here, but correct approach) —
   resolve hostname to IP before fetching, validate the IP, fetch to the IP.
   Prevents DNS rebinding.
4. **Response size limit** — cap response bytes to prevent reading huge
   files if SSRF is partially achieved.
5. **Internal network segmentation** — internal services should not be
   reachable from application servers at all. SSRF is only possible because
   `victim-server.js` and `internal-server.js` share a network. In production,
   use VPC security groups, firewalls, or service mesh policies to enforce
   this separation at the network layer — defense in depth.

### Code comment style (match existing demos)

```
// ⚠️ VULNERABILITY: <what and why>
// ✅ FIX: <what was changed and why it works>
```
