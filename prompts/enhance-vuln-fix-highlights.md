# Enhance All 16 Attacks — Vulnerable Lines + Fix Highlights

## Objective

Make the core vulnerability and its fix unmistakably visible in every attack demo —
both in the **source code** (inline comments) and in each project's **README.md**.

Two reference implementations already exist — match them exactly:

- **Code comment style**: `prototype-pollution/victim-server.js` + `victim-server-protected.js`
- **README section style**: `jwt-attacks/README.md` (sections `## Vulnerable Lines` and `## The Fix`)

Read both reference files before starting. Do not change any functional logic — only
add comments and README sections.

---

## Part 1 — Inline comments in source files

### Philosophy: educational depth, not one-liners

These comments are **teaching material**. A single-line summary wastes the
opportunity. Each comment should answer:
- **What** is wrong / fixed
- **Why** it is exploitable / safe
- **How** the attack works mechanically (for the vulnerable side)
- Any **nuance** a student would miss without running the demo (e.g., localhost
  caveats, option differences, what specific payloads exploit it)

If a comment already exists and is more detailed than what you would write — keep
it or expand it. **Never simplify or shorten an existing comment.** If it is
already thorough, mark it as verified and move on.

---

### Vulnerable server files (`victim-server.js` or equivalent)

Add a `// ⚠️ VULNERABLE —` block comment **immediately above** the exploitable
function, expression, or statement.

**Good example — multi-line, explains the mechanism:**
```js
// ⚠️ VULNERABLE — req.body fields are passed directly into the query object.
// express.json() parses nested JSON, so { "password": { "$gt": "" } }
// becomes a MongoDB operator — findOne evaluates it as a comparison, not a
// string match. Any operator ($gt, $ne, $regex …) works the same way.
app.post('/login', function (req, res) {
```

**Bad example — do NOT write this:**
```js
// ⚠️ VULNERABLE — req.body fields passed directly into query
app.post('/login', function (req, res) {
```

Rules:
- One comment block per distinct root cause. If two independent issues exist,
  write two separate `// ⚠️ VULNERABLE` blocks, each at its own root-cause line.
- If the vulnerability is a **missing** control (no header, no check), place the
  comment at the route/middleware line where the control should be applied.
- Aligned continuation lines use `// ` (two spaces after `//`) for readability.

---

### Protected server files (`victim-server-protected.js` or equivalent)

Add a `// ✅ PROTECTED —` block comment immediately above the fix.

When two separate mechanisms protect against the same issue, label them to show
the relationship:

```js
// ✅ PROTECTED (primary): X-Frame-Options tells the browser to refuse rendering
//    this page inside any <iframe>, <frame>, or <object> element.
//    DENY = no framing by anyone.
//    SAMEORIGIN = framing allowed only from the same origin.
app.use(function (req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  ...
// ✅ PROTECTED (modern): CSP frame-ancestors supersedes X-Frame-Options in all
//    modern browsers. More flexible — can specify multiple allowed origins.
//    'none' = equivalent to X-Frame-Options: DENY.
//    'self' = equivalent to X-Frame-Options: SAMEORIGIN.
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
```

---

### Per-attack depth guide

For each attack, here is the specific nuance that MUST appear in the comments —
this is what makes the difference between a comment that teaches and one that
just labels:

**csrf** — On `SameSite=Strict`: mention that on localhost ALL ports share the
same "site", so the protection only demonstrates against separate domains
(e.g., evil.com → bank.com). Students running the demo locally need this or they
will think the demo is broken.

**clickjacking** — On the protected side: explain DENY vs SAMEORIGIN options.
Explain that CSP `frame-ancestors` supersedes `X-Frame-Options` in modern
browsers and is more flexible.

**reverse-tabnabbing** — Comment on the `<a target="_blank">` line in the HTML
being served. Explain that `window.opener` gives the new tab a reference back to
the original page and can redirect it.

**ssrf** — On `fetch(url)`: explain that the server makes the request from
its own network, bypassing firewalls that block browser-to-internal access. The
metadata endpoint (169.254.169.254) is reachable from server but not from browser.

**nosql-injection** — Explain `express.json()` enables the attack by parsing
`{ "$gt": "" }` as a real JS object before it reaches the route handler.
Name at least one working payload.

**sql-injection** — Show the specific attack string inline in the comment
(e.g., `' OR '1'='1` or `admin'--`). Explain that string concatenation lets
the attacker terminate the query early and inject new clauses.

**prototype-pollution** — Already complete. Verify only.

**event-loop-blocking** — Explain that when the main thread is occupied, ALL
concurrent requests — not just the slow one — receive no response until the
computation finishes. One request starves everyone else.

**jwt-attacks** — Two separate issues: (1) `alg:none` — the attacker controls
the `alg` field inside the token header, so setting it to `none` skips
signature verification entirely, no secret needed. (2) weak secret — `'secret'`
appears in any JWT wordlist; once cracked the attacker can forge any payload.

**command-injection** — Explain WHY `exec()` is dangerous: it spawns a shell,
so `;`, `&&`, `|` chain additional commands. `execFile()` with an array bypasses
the shell entirely — no string interpretation occurs.

**idor** — Note the 404 vs 403 distinction in the protected server: returning
403 confirms the record exists (information leak); 404 hides the existence of
records the requester has no access to.

**path-traversal** — Explain that `path.join()` normalises `../` sequences but
does NOT prevent traversal outside the intended directory. `path.resolve()` +
`startsWith(baseDir)` is the containment check that actually enforces the
boundary.

**mass-assignment** — Name the specific dangerous fields (e.g., `isAdmin`,
`role`, `balance`) and explain that `Object.assign(user, req.body)` blindly
copies every key the client sends, including ones never intended to be writable.

**xss (all variants)** — Explain the difference between `innerHTML` (executes
scripts and event handlers) and `textContent` / proper encoding (treats
everything as literal text). For SVG upload: mention that SVG is XML that can
contain inline `<script>` tags, bypassing image-type checks.

---

## Part 2 — README `## Vulnerable Lines` and `## The Fix` sections

Open each attack's `README.md`. Read the existing structure to determine placement,
then add (or verify) these two sections in the exact format used by `jwt-attacks/README.md`:

```markdown
## Vulnerable Lines

\`\`\`js
// ⚠️ Short explanation of why this line is exploitable
const BAD_THING = doUnsafeThing(userInput);

// ⚠️ Second issue if there are two distinct root causes
const ANOTHER_PROBLEM = 'weak';
\`\`\`

---

## The Fix

\`\`\`js
// ✅ Short explanation of what makes this safe
const SAFE_THING = doSafeThing(allowlist, userInput);

// ✅ Second fix
const STRONG_SECRET = require('crypto').randomBytes(64).toString('hex');
\`\`\`
```

Placement rules:
- Insert **after** the last "Attack Walkthrough" section
- Insert **before** any trailing sections (logout demo, theory notes, etc.)
- Separate from adjacent sections with `---` dividers on both sides
- Use the correct fence language tag: `js` for JavaScript, `sql` for SQL queries,
  `html` for HTML, etc.
- Show only the minimal snippet that demonstrates the issue — 3–15 lines is ideal.
  Do not paste the entire function if only one line matters.
- The code shown must match exactly what is in the actual source file

If `## Vulnerable Lines` and `## The Fix` sections already exist (as in jwt-attacks
and prototype-pollution), verify the content is accurate and the format matches —
update only if something is wrong.

---

## Attacks to process

Read each folder's actual files before editing. Identify the real vulnerable
lines yourself — do not guess from attack names alone.

| Attack folder         | Vulnerable file(s)          | Protected file(s)                    | Notes |
|-----------------------|-----------------------------|--------------------------------------|-------|
| `xss/`                | Varies per sub-variant      | Varies per sub-variant               | 3 sub-variants (stored / reflected / svg-upload). Check folder structure; each sub-variant has its own server pair and README. |
| `csrf/`               | `victim-server.js`          | `victim-server-protected.js`         | |
| `clickjacking/`       | `victim-server.js`          | `victim-server-protected.js`         | Vulnerability is a missing response header |
| `reverse-tabnabbing/` | `victim-server.js`          | `victim-server-protected.js`         | Vulnerability is in the HTML anchor tag served, not the server logic itself — show the HTML snippet |
| `ssrf/`               | `victim-server.js`          | `victim-server-protected.js`         | |
| `nosql-injection/`    | `victim-server.js`          | `victim-server-protected.js`         | |
| `sql-injection/`      | `victim-server.js`          | `victim-server-protected.js`         | |
| `prototype-pollution/`| `victim-server.js`          | `victim-server-protected.js`         | **Reference implementation — verify only, do not overwrite unless something is wrong** |
| `event-loop-blocking/`| `victim-server.js`          | `victim-server-protected.js`         | Vulnerability is the synchronous CPU operation on the main thread |
| `jwt-attacks/`        | `victim-server.js`          | `victim-server-protected.js`         | README already updated — verify code file comments exist; add if missing |
| `command-injection/`  | `victim-server.js`          | `victim-protected-server.js`         | Note: protected file uses `-protected-server` naming |
| `idor/`               | vulnerable server file      | protected server file                | Read folder to confirm filenames |
| `path-traversal/`     | `victim-server.js`          | `victim-server-protected.js`         | |
| `mass-assignment/`    | `victim-server.js`          | `victim-server-protected.js`         | |

---

## What NOT to touch

- Do not modify any functional logic, route handlers, or response behaviour
- Do not reformat surrounding code
- Do not add comments inside `attack-guide-server.js`, `attacker-server.js`,
  `internal-server.js`, or `attack-console-server.js` — those are attacker tools,
  not the targets
- Do not add `// ⚠️` to every line inside a function — only the one line that is
  the root cause of the vulnerability
- Do not change the README structure outside of adding the two new sections and
  their surrounding `---` dividers
