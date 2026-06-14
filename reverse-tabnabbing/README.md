# Reverse Tabnabbing Attack Demo — TechBlog

## Port Reference

| Port | Role | File |
|------|------|------|
| 3016 | Vulnerable victim (TechBlog) | `victim-server.js` |
| 3017 | Attacker (fake article + phishing clone) | `attacker-server.js` |
| 3018 | Protected victim (TechBlog) | `victim-server-protected.js` |

---

## Attack Flow

```
Victim is on TechBlog (3016), clicks a "Read more →" link (target="_blank")
        ↓
New tab opens — controlled by attacker (3017)
        ↓
Attacker page runs: window.opener.location = 'http://localhost:3017/phishing'
        ↓
Original TechBlog tab silently redirects to a pixel-perfect phishing clone
        ↓
Victim sees "session expired" login prompt, enters credentials → stolen
```

---

## Attack Walkthrough

1. `cd demo-attacked/reverse-tabnabbing && npm install`
2. Terminal 1: `npm run victim` → TechBlog at **localhost:3016**
3. Terminal 2: `npm run attacker` → Attacker at **localhost:3017**
4. Open **localhost:3016** — you are logged in as Alex Reader.
5. Click **"How AI Is Reshaping Frontend Development ↗"** — a new tab opens with the external article.
6. Read a sentence or two (the tab swap has already happened silently).
7. Switch back to the original tab.
8. You are now on **localhost:3017/phish** — a TechBlog login page asking you to re-authenticate. The URL gives it away, but most users don't check.
9. Type any credentials and submit.
10. Open **localhost:3017/dashboard** — your credentials appear instantly.

---

## Protected Demo

1. Terminal 3: `npm run victim-protected` → protected TechBlog at **localhost:3018**
2. Open **localhost:3018**, click the same external article.
3. Switch back — original tab is still on TechBlog, untouched.
4. On the attacker page, `window.opener` is `null` — the redirect silently failed.

Use the victim switcher on the attacker dashboard to open **3016** or **3018** in a new tab.

---

## Referer Leakage Demo

Same servers as the main demo (all three must be running).

### Setup

Terminal 1: `npm run victim` · Terminal 2: `npm run attacker` · Terminal 3: `npm run victim-protected`

Open **localhost:3017/dashboard** — use the **Referer Leak Demo** buttons at the bottom.

### Vulnerable path (noopener only — Referer leaks)

1. Click **"Open Vulnerable TechBlog Newsletter"**.
2. Notice the URL: `localhost:3016/newsletter?subscriber_id=ALEX_READER_TOKEN_f3a9c2b1&...`
3. The page highlights your subscriber token — it's in the URL, as it would be in a real newsletter link.
4. Click **"Read Full Article →"** — a new tab opens at `localhost:3017/article`.
5. The article page immediately shows a red box: **"Referer header received"** with your full URL and extracted `subscriber_id` token.
6. The tabnabbing attack did NOT fire (`window.opener` is null) — but the token leaked anyway via the Referer header.

### Protected path (noopener + noreferrer — both blocked)

1. Click **"Open Protected TechBlog Newsletter"** from the dashboard.
2. Same URL, same token in the address bar.
3. Click **"Read Full Article →"**.
4. The article page shows a green box: **"No Referer received"** — the token never left your browser.

### Key insight

```
rel="noopener"            → window.opener = null  ✅  (tabnabbing blocked)
                          → Referer header sent   ⚠️  (token leaked to external site)

rel="noopener noreferrer" → window.opener = null  ✅  (tabnabbing blocked)
                          → Referer header absent ✅  (token never sent)
```

`noopener` and `noreferrer` block two different channels of information flow:

- `noopener`: blocks the new tab from reaching **back** into your tab
- `noreferrer`: blocks your tab from sending data **forward** to the new tab

---

## Vulnerable Line (Exact)

**`victim-server.js`** — the external article link:

```html
<a href="http://localhost:3017" target="_blank" rel="opener nofollow">
```

The vulnerability is `rel="opener"`. Removing it (or replacing with `rel="noopener noreferrer"`) fully neutralises the attack.

---

## Why the Attack Requires a Direct Left-Click

The attack depends on how the new tab is created. Browsers distinguish between two fundamentally different cases:

**Page-initiated (left-click):** The page's link navigation fires. The browser opens a new tab as a *child* of the current browsing context and sets `window.opener` to the parent's `window`. The new tab was born from the page — it gets a reference back.

**User-initiated (right-click → "Open in new tab"):** The browser intercepts this at the OS level before the page's navigation fires. The URL opens as a completely independent tab with no parent context — `window.opener` is `null`. The attacker page loads, runs `if (window.opener)`, the check fails, nothing happens.

Same result for middle-click and Cmd+click (Mac) / Ctrl+click (Windows) in most browsers — all treated as user-initiated, not page-initiated.

This is why the walkthrough says to click the article link directly. The attack only fires on normal left-click navigation.

### How `noopener` and `noreferrer` behave differently under right-click

Right-click "Open in new tab" reveals that the two defenses operate on different axes:

| Navigation method | `window.opener` without rel | Effect of `noopener` | Referer sent without rel | Effect of `noreferrer` |
|-------------------|----------------------------|----------------------|--------------------------|------------------------|
| Left-click | Live — attack works | Sets it to `null` ✅ | Yes — full URL (with `unsafe-url`) | Suppresses it ✅ |
| Right-click → Open in new tab | Already `null` — attack fails anyway | Redundant, no extra effect | **Yes — still sent** | Still suppresses it ✅ |
| Middle-click / Ctrl+click | Already `null` | Redundant | Yes — still sent | Still suppresses it ✅ |

The key insight: `noopener` only matters for left-click. `noreferrer` matters for **every** navigation method because the Referer HTTP header is sent regardless of how the tab was opened. The browser reads the `rel` attribute of the `<a>` tag and applies `noreferrer` even when the user triggered the navigation manually.

This means:
- If you only care about the tabnabbing attack: left-click is the only threat vector
- If you care about Referer leakage: every navigation method leaks the token, not just left-click

---

## What `rel` Values Actually Do

`rel` specifies the *relationship* between your document and the linked one. Values are space-separated and independent of each other. Most have nothing to do with security.

### Security / privacy values

| Value | Effect | Scope |
|-------|--------|-------|
| `noopener` | Sets `window.opener = null` in the new tab | Security only |
| `noreferrer` | Suppresses the `Referer` HTTP header | Privacy; also implies `noopener` in modern browsers |
| `opener` | **Explicitly re-enables** `window.opener` | Overrides the Chrome 88+ implicit default |

### SEO values — no security effect

| Value | Effect |
|-------|--------|
| `nofollow` | Tells Google's crawler not to pass PageRank through this link. Browsers ignore it entirely at runtime — zero effect on `window.opener`, Referer, or anything security-related. |
| `ugc` | Signals User Generated Content to crawlers. Crawler hint only. |
| `sponsored` | Marks a paid/affiliate link for Google. Crawler hint only. |

### Semantic values — no security effect

`external`, `author`, `alternate`, `help`, `license`, `next`, `prev`, `search`, `tag` — purely descriptive. Some browsers show minor UI hints (e.g. an external link icon for `external`) but none affect tab behavior or security.

### What `rel="opener nofollow"` means

`opener` does the security-relevant work — it explicitly re-enables `window.opener`. `nofollow` is cosmetic, telling Google's crawler not to follow the link. They're orthogonal: you could write them in either order. From a security perspective this is identical to just `rel="opener"`.

---

## What Happens With No `rel` At All

This is the most important history to understand.

**Before 2020 (all browsers):**
No `rel` + `target="_blank"` = `window.opener` is live. This was the spec default for 25 years. Millions of sites were vulnerable by just writing `target="_blank"` without thinking about it.

**After 2020 (browsers changed the default):**

| Browser | Version | Date | Default `target="_blank"` behavior |
|---------|---------|------|-------------------------------------|
| Safari | 12.1 | Mar 2019 | `noopener` implicit — `window.opener` is null |
| Firefox | 79 | Jul 2020 | `noopener` implicit — `window.opener` is null |
| Chrome | 88 | Jan 2021 | `noopener` implicit — `window.opener` is null |
| IE11 | — | Never | `window.opener` still live — attack still works |

So today, leaving `rel` unset on a `target="_blank"` link means: modern Chrome/Firefox/Safari protect you automatically. IE11 and any browser that predates the 2020–2021 changes does not.

**Why our demo uses `rel="opener"` explicitly:**

Without it, Chrome 88+ silently neutralises the attack before it starts — the demo fails with no explanation. `rel="opener"` overrides the browser default and restores the pre-2021 behavior, which is what you actually encounter in:

- Old codebases written before Chrome 88
- Third-party widgets and libraries that auto-generate `target="_blank"` links
- Any code where `rel="opener"` was set intentionally or by copy-paste mistake
- IE11 (where neither the default nor `rel="opener"` matters — `window.opener` is always live)

## Why Modern Browsers Don't Fully Solve This

The implicit `noopener` default is a great improvement, but relying on it is fragile:

- `rel="opener"` immediately bypasses it — one attribute overrides years of browser hardening
- Third-party widgets and CMSs may generate links the browser treats differently depending on rendering context
- The default only applies when the browser is certain you intended `target="_blank"` as a navigation — edge cases exist

The fix (`rel="noopener noreferrer"`) has been the correct answer since 2015. Always write it explicitly. Don't rely on browser defaults to cover your intent.

---

## Defense Details

### Why both `rel="noopener"` and `rel="noreferrer"`?

They were invented for different concerns and were not always equivalent.

**`rel="noopener"`** is a **security** fix — its sole job is setting `window.opener = null` in the new tab. The attacker page cannot reference or redirect the original tab. It does nothing about the `Referer` header.

**`rel="noreferrer"`** is a **privacy** fix — it suppresses the `Referer` HTTP header so the destination site never learns which page the user came from. In modern browsers it *also implies* `noopener`, because if you're already hiding your referrer, you probably don't want to hand the destination a live reference to your tab either.

The implication runs one way only: `noreferrer` → `noopener`. `noopener` alone does **not** suppress the `Referer` header.

### The fallback chain

```
Old browser (pre-Chrome 49 / pre-Firefox 52):
→ sees rel="noreferrer" → suppresses Referer ✅ (privacy)
→ doesn't know noopener → window.opener still live ⚠️ (tabnabbing still works)
→ sees rel="noopener"  → sets window.opener = null ✅ (security fix)

Modern browser (Chrome 49+, Firefox 52+, Safari 12.1+):
→ sees rel="noreferrer" → suppresses Referer ✅ (privacy)
→ noreferrer implies noopener → window.opener = null ✅ (security)
→ rel="noopener" also present → same result, redundant, harmless
```

Without explicit `noopener`, browsers that supported `noreferrer` for privacy before `noopener` was invented (2016) would suppress the `Referer` header but leave `window.opener` fully accessible. The tabnabbing attack still works in those browsers.

This is the same pattern as `X-Frame-Options` + `CSP frame-ancestors` in the clickjacking demo: two attributes covering two different browser generations, neither alone sufficient for full coverage.

| What you write | window.opener | Referer header | Old browser safe |
|----------------|---------------|----------------|-----------------|
| `noopener` only | null ✅ | sent ⚠️ | yes |
| `noreferrer` only | null ✅ (modern) / live ⚠️ (old) | suppressed ✅ | no |
| `noopener noreferrer` | null ✅ | suppressed ✅ | yes |

Always write both explicitly. Don't rely on the implication.

### `Referrer-Policy: no-referrer` (server-level)

Applied via middleware on the protected server. Covers all navigation from the page — not just links that have the `rel` attribute set. Defense in depth: even if a third-party widget injects a `target="_blank"` link without the attribute, the server-level policy still suppresses the `Referer` header.

**Protected server (`victim-server-protected.js`):**

```html
<a href="http://localhost:3017" target="_blank" rel="noopener noreferrer">
```

```js
res.setHeader('Referrer-Policy', 'no-referrer');
```

---

## Same-Origin Asymmetry: Write vs Read on `window.opener`

The browser enforces an asymmetric rule on cross-origin `window.opener` access:

```
window.opener.location = 'http://localhost:3017/phish'  ✅  allowed cross-origin  ← the attack
window.opener.location.href                              ❌  SecurityError          ← blocked
window.opener.location.toJSON()                          ❌  SecurityError          ← blocked
JSON.stringify(window.opener.location)                   ❌  SecurityError          ← blocked
```

**Why writes are allowed:** Navigating a window away is considered the opener's own business. The spec deliberately permits it — it's how popups close and redirect their parent (e.g., after OAuth). The browser trusts the opener to decide where the tab goes.

**Why reads are blocked:** Reading any property of a cross-origin window leaks information about that origin — the URL, the document title, the current path. That would let any attacker page silently fingerprint where the user came from. The Same-Origin Policy blocks all cross-origin reads.

**Practical consequence:** The correct attack code is a blind write only:

```js
// ✅ correct — write only, no read
if (window.opener && !window.opener.closed) {
  window.opener.location = 'http://localhost:3017/phish';
}
```

Any attempt to READ `window.opener.location.*` before or after the write throws an `Uncaught SecurityError` and breaks the attack. A common Cursor/Copilot mistake is adding a debug `console.log(JSON.stringify(window.opener.location))` — this fires a SecurityError before the redirect ever runs.

---

## Why the Referer Demo Needs `Referrer-Policy: unsafe-url`

The Referer leakage demo adds `res.setHeader('Referrer-Policy', 'unsafe-url')` to the vulnerable newsletter route. This is not arbitrary — without it, Chrome silently hides the token even without any `rel` attribute.

### Chrome's default changed in 2020

| Era | Default Referrer-Policy | Cross-origin behaviour |
|-----|------------------------|----------------------|
| Chrome ≤84 (pre-Aug 2020) | `no-referrer-when-downgrade` | Full URL sent cross-origin (HTTP→HTTP) — all tokens leak |
| Chrome 85+ (Aug 2020) | `strict-origin-when-cross-origin` | Only bare origin sent cross-origin — path and query stripped |

**`strict-origin-when-cross-origin` in practice:**

```
Navigation: localhost:3016/newsletter?subscriber_id=TOKEN  →  localhost:3017/article

Referer sent: http://localhost:3016/    ← origin only, subscriber_id stripped
```

Different ports = different origins. Chrome strips everything after the origin for cross-origin navigations under its default policy. The token never reaches the attacker server — the demo appears broken.

### The `304 Not Modified` evidence

DevTools reveals exactly what happened before and after the fix:

| | Before fix | After fix |
|-|------------|-----------|
| Status | `304 Not Modified` | `200 OK` |
| Referrer Policy (DevTools) | `strict-origin-when-cross-origin` | `unsafe-url` |
| Referer received | `http://localhost:3016/` | `http://localhost:3016/newsletter?subscriber_id=TOKEN&...` |

`304 Not Modified` means the browser served a cached copy of the newsletter page — the server never sent new response headers, so the old `Referrer-Policy` (Chrome default) applied. After restarting the victim server with `unsafe-url` set and doing a hard refresh (`Ctrl+Shift+R`), the server sends a `200 OK` with the new header, the browser applies `unsafe-url` for that document's outgoing navigations, and the full URL reaches the attacker.

### Why `unsafe-url` is realistic

The demo uses `unsafe-url` to simulate what many production apps actually do:

- **Analytics SDKs** (Google Analytics, Segment, Mixpanel) commonly inject `<meta name="referrer" content="unsafe-url">` or set the header to preserve full traffic attribution data
- **Legacy CMSs** (WordPress plugins, older Drupal/Joomla configs) default to `unsafe-url` because they predate Chrome 85
- **Affiliate/partner tracking** systems deliberately use `unsafe-url` so the destination partner sees the full referral URL with campaign codes
- **A/B testing tools** need the full URL to attribute which variation a user came from

The attack is realistic specifically because real apps frequently opt out of Chrome's safe default.

### Two ways to set Referrer-Policy — HTTP header vs meta tag

Both are equivalent; they set the same document-level policy:

```js
// Server (Express) — HTTP response header
res.setHeader('Referrer-Policy', 'unsafe-url');
```

```html
<!-- HTML <head> — meta tag -->
<meta name="referrer" content="unsafe-url">
```

**When to use which:**
- The HTTP header is authoritative and applies before the HTML is parsed
- The meta tag is useful for static HTML files you don't control server responses for, or when an analytics SDK injects it client-side
- If both are present, the meta tag takes precedence (it overrides the header)
- The meta tag is why CDNs or reverse proxies stripping response headers don't help — the vulnerability is baked into the HTML itself

### All `Referrer-Policy` values

| Value | Same-origin | Cross-origin | Downgrade (HTTPS→HTTP) |
|-------|------------|--------------|----------------------|
| `no-referrer` | nothing | nothing | nothing |
| `no-referrer-when-downgrade` | full URL | full URL | nothing |
| `origin` | origin only | origin only | origin only |
| `origin-when-cross-origin` | full URL | origin only | origin only |
| `same-origin` | full URL | nothing | nothing |
| `strict-origin` | origin only | origin only | nothing |
| `strict-origin-when-cross-origin` | full URL | origin only | nothing — **Chrome 85+ default** |
| `unsafe-url` | full URL | full URL | full URL — **never safe** |

Most apps should use `strict-origin-when-cross-origin` (already the Chrome default) or `no-referrer` for pages with sensitive URL parameters. `unsafe-url` should only appear when explicitly required for tracking purposes, and only on pages whose URLs contain no secrets.

---

## Why These Features Exist — Legitimate Use Cases

`window.opener` and the `Referer` header are not bugs. They were intentional features, and both still serve real purposes. The question is not whether to delete them but whether to opt in deliberately.

### Legitimate uses of `window.opener`

**OAuth popup flows** — the most common example. You click "Sign in with Google", a popup window opens, you authenticate, and the popup calls `window.opener.postMessage({ token: '...' }, origin)` to send the token back to the original tab. Without `window.opener`, the popup cannot communicate the result and the flow breaks. This is why `rel="opener"` exists — it's required for OAuth, not an oversight.

**Payment popups** — PayPal, Stripe Checkout, Klarna all use opener-reference popups. The popup renders the payment form in a sandboxed context, then signals the parent page when payment completes.

**Multi-window coordinated apps** — desktop-style web apps (trading platforms, IDEs, dashboards) open separate browser windows that communicate via `postMessage` on the opener reference. Killing opener breaks the communication bus.

**Print dialogs** — `window.print()` in a popup sometimes references the opener to get the page content.

The pattern is always `window.opener.postMessage(data, targetOrigin)` — structured messaging that the receiving page can validate. Not writing to `window.opener.location` directly.

### Legitimate uses of the `Referer` header

**Analytics and traffic attribution** — "How many users came from our newsletter vs. Twitter vs. organic search?" The entire concept of traffic sources in Google Analytics, Mixpanel, etc. depends on reading the `Referer` header.

**Hotlinking protection** — image hosts (and CDNs) check `Referer` to block embedding on external sites. If `Referer` is absent or mismatched, the server serves a "direct link blocked" placeholder instead of the real image.

**Affiliate / partner attribution** — "Users who came via our partner's link get a 20% discount." The merchant's server reads `Referer` to confirm the user actually navigated from the affiliate site.

**CSRF secondary defense** — some frameworks do a `Referer` origin check as a second layer (after CSRF token validation) to block forged requests from unrelated origins.

**Server-side debugging** — `Referer` tells the backend which page triggered a specific API call, which is useful for diagnosing unexpected error spikes.

The lesson is that every feature that creates a vulnerability also solves a real problem. Security improvements (Chrome 85's `strict-origin-when-cross-origin`, Chrome 88's implicit `noopener`) always keep the explicit opt-in path open because removing it would break legitimate use cases.

---

## `rel` on `<link>` Tags

The same `rel` attribute appears on `<link>` tags in the document `<head>`. These have zero relation to security — they're entirely about resource loading, SEO, and browser hints. They're included here because they appear in the same HTML attribute and cause confusion.

| Value | What it does |
|-------|-------------|
| `stylesheet` | Loads a CSS file |
| `icon` | Browser tab favicon |
| `manifest` | PWA web app manifest |
| `canonical` | Tells search engines which URL is the "true" version when a page is accessible at multiple URLs (handles query params, pagination, www vs non-www). Only one canonical per page. |
| `alternate` | Alternative representations: RSS/Atom feeds (`type="application/rss+xml"`), translated versions (`hreflang="fr"`), AMP pages (`media="only screen and (max-width: 640px)"`). |
| `preload` | High-priority fetch before it's needed — fonts, critical CSS, hero images. Uses `as="font"` / `as="script"` / etc. |
| `prefetch` | Low-priority background fetch for a resource the user will probably need on the next page. |
| `preconnect` | Establishes a TCP/TLS connection to an origin early, before the resource URL is known. Used for third-party origins: fonts.googleapis.com, cdn.segment.io. |
| `dns-prefetch` | Resolves the DNS for an origin without opening a full connection. Lighter than preconnect; use when preconnect would be wasted on connections that rarely complete. |
| `modulepreload` | Like preload but specifically for ES modules — parses and compiles the module, not just fetches it. |

None of these have any security effect. `<link rel="canonical">` does not prevent indexing. `<link rel="preload">` does not send any Referer. `<link rel="icon">` does not set `window.opener`. They are resource-management instructions to the browser's loading machinery.

The `rel="noopener"`, `rel="noreferrer"`, `rel="opener"` values only appear on `<a href="..." target="_blank">` and `<area>` tags — not on `<link>` tags.

---

## `nofollow` — A Different Kind of `rel`

`rel="nofollow"` is frequently grouped with security `rel` values, but it has no security function whatsoever.

**Origin:** Google invented `nofollow` in January 2005 to fight comment spam. Blog comment sections at the time were flooded with automated bots dropping links because links = PageRank. Google proposed that CMS platforms add `rel="nofollow"` to user-submitted links, signalling to Googlebot not to pass PageRank through those links. Spamming a comment field becomes worthless if the link doesn't help your search ranking.

**What browsers do with it:** Nothing. `nofollow` is a crawler instruction, not a browser instruction. The browser loads the page exactly as if the attribute were absent.

**No security effect:**
- Does not set `window.opener = null`
- Does not suppress the `Referer` header
- Does not block navigation
- Does not affect tab behavior

**2019 refinements — `ugc` and `sponsored`:**

| Value | Meaning | When required |
|-------|---------|--------------|
| `nofollow` | Don't pass PageRank — reason unspecified | General user content, untrusted links |
| `ugc` | User Generated Content — link from comments, forums | Community-submitted links |
| `sponsored` | Paid/affiliate link | Ad placements, sponsored content |

Google made `nofollow` a "hint" rather than a directive in September 2019 — it may now follow nofollow links if the content is high-quality. `ugc` and `sponsored` remain strict directives.

**Why it's commonly paired with security `rel` values:**

Because security guidance often says "don't let external links carry your PageRank" alongside "don't let external links access `window.opener`". The two concerns happen to be addressed in the same attribute. But they're completely independent:

```html
rel="noopener noreferrer"         ← security + privacy, zero SEO effect
rel="noopener noreferrer nofollow" ← security + privacy + PageRank isolation
rel="nofollow"                     ← PageRank isolation only, zero security effect
```

In the demo, `rel="opener nofollow"` on the vulnerable link means: re-enable `window.opener` for the attack (security), and don't pass PageRank to the attacker domain (SEO). They do different jobs.

---

## How Web Security Evolves

The same arc repeats across every browser security improvement:

1. **Unsafe default** — feature ships with the "useful" behavior. Developers assume the browser is permissive.
2. **Vulnerability discovered** — researchers document how the feature can be abused at scale.
3. **Opt-in defense** — spec adds an explicit value or header to opt into the safe behavior. Only security-aware developers use it.
4. **Safe default** — browser changes the default to the safe behavior, breaking nothing for most users.
5. **Explicit opt-in preserved** — browser keeps the original unsafe behavior available via explicit flag for legitimate use cases.

| Feature | Unsafe default | Safe default | Explicit opt-in to preserve old behavior |
|---------|---------------|-------------|----------------------------------------|
| `window.opener` | Always live (pre-2020) | `null` implicit on `target="_blank"` (Chrome 88, Jan 2021) | `rel="opener"` |
| Referrer header | Full URL cross-origin (Chrome ≤84) | Origin-only cross-origin (Chrome 85, Aug 2020) | `Referrer-Policy: unsafe-url` |
| SameSite cookies | No SameSite = Lax+unsafe (pre-2020) | No SameSite = Lax strict (Chrome 80, Feb 2020) | `SameSite=None; Secure` |
| Mixed content | Images/iframes allowed HTTP in HTTPS page | Blocked by default (Chrome 81, Apr 2020) | None — no legitimate use |
| `<iframe>` embedding | Any page embeddable by default | X-Frame-Options / CSP frame-ancestors required | Allow via `frame-ancestors` policy |

**Why not just remove the unsafe behavior entirely?** Because `window.opener` via `postMessage` is how OAuth works. Because `Referer` is how analytics attribution works. Because `SameSite=None` is how federated login cookies work across domains. The browser cannot unilaterally break the web's existing infrastructure — it can only change the default and let developers opt out.

**What this means for demos like this one:** The `rel="opener"` and `Referrer-Policy: unsafe-url` in the vulnerable servers are not fake or contrived — they simulate the state of every codebase that was written before 2021, every third-party widget that generates links without thinking about `rel`, and every CMS or analytics SDK that deliberately preserves full Referer for tracking. That's most of the production web.

---

<<<<<<< HEAD
## The `Referer` Typo — Why Two Spellings Coexist

The HTTP header is spelled `Referer` (one `r`). The correct English word is `referrer` (two `r`s). This is a 1996 typo in RFC 1945 that became permanent because fixing it would have broken every HTTP implementation on the internet. The working group noticed and chose backward compatibility over correctness.

Result: the web has two spellings in active use that mean the same thing:

| Where | Spelling | Why |
|-------|----------|-----|
| HTTP request header (browser → server) | `Referer` | RFC 1945 typo — can never change |
| HTML `rel` attribute | `noreferrer` | HTML spec used the correct spelling |
| HTTP response header | `Referrer-Policy` | Correct spelling — newer spec, 2017 |
| Express `req.headers` key | `referer` | Matches what browsers actually send |
| `req.headers.referrer` | `referrer` | Checked defensively — no modern browser sends this |

The code in `attacker-server.js`:

```js
const referer = req.headers.referer || req.headers.referrer || null;
```

The first check (`referer`) is what every modern browser sends. The second (`referrer`) is a defensive fallback — some very old HTTP proxies or poorly written HTTP libraries "corrected" the typo and forwarded the header with the proper spelling. No browser does this, but the fallback costs nothing.

---

=======
>>>>>>> 68c825557fec214a8cf218061641589c4826715d
## Attacker Routes

| Route | Purpose |
|-------|---------|
| `GET /` | Fake external article — redirects original tab via `window.opener` |
| `GET /article` | Referer leak demo — displays Referer header received from browser |
| `GET /phish` | Pixel-perfect TechBlog phishing clone with login modal |
| `POST /api/steal` | Receives stolen credentials |
| `GET /api/stolen` | JSON list for dashboard polling |
| `GET /dashboard` | Attacker control panel with victim switcher + Referer demo buttons |

### Victim newsletter routes

| Route | Port | `rel` on external link |
|-------|------|--------------------------|
| `GET /newsletter` | 3016 | `noopener nofollow` (Referer leaks) |
| `GET /newsletter` | 3018 | `noopener noreferrer nofollow` (Referer suppressed) |
