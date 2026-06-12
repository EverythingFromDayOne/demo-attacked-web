# Cursor Prompt — Reflected XSS Demo: E-Commerce Search Page

## Context

This is the second demo in the XSS security education series (after Stored XSS).
The goal is to demonstrate Reflected XSS in a believable, production-like environment.
The critical distinction from Stored XSS: the payload is never saved to a database.
It lives only in the URL, is reflected once by the server into the HTML response, fires,
then disappears. The attack requires social engineering — the victim must be tricked into
clicking a crafted link.

All intentional vulnerabilities must be marked with `// ⚠️ VULNERABILITY:` comments.
All fixes must be mentioned in `// ✅ FIX:` comments directly below.
No TypeScript. Plain JS, CommonJS require syntax. No build step. Inline CSS only.

---

## Real-World Scenario

**Target:** ShopNest — a mid-size e-commerce platform.
**Victim:** A logged-in customer "Jane" browsing for products. She has a session cookie.
**Attacker:** An external threat actor who discovered that ShopNest's search page reflects
the `?q=` query parameter directly into the HTML response without sanitizing it.
**Attack chain:**
1. Attacker crafts a malicious search URL containing a JavaScript payload in the `?q=` param.
2. Attacker wraps the URL in a convincing phishing email — "Your saved search has new results!"
3. Jane receives the email, clicks the link, lands on ShopNest's search page.
4. The server echoes the `?q=` value into the HTML. The browser executes the script.
5. Jane's session cookie is silently sent to the attacker's collector server.
6. Jane sees a normal-looking search results page and has no idea anything happened.

This exact attack pattern was documented in public CVEs against early Shopify stores,
Magento 1.x installations, and numerous custom-built e-commerce platforms.

---

## File Structure

All files inside `demo-attacked/xss/reflected/`:

```
reflected/
  victim-server.js      — ShopNest backend (port 3003)
  attacker-server.js    — Cookie collector + phishing tool backend (port 3004)
  victim.html           — ShopNest storefront (static, served by victim-server)
  attacker.html         — Attacker dashboard: phishing composer + stolen cookie feed
  package.json          — dependencies: express, cors
```

Ports 3003 and 3004 are chosen so both this demo and the Stored XSS demo
(ports 3001/3002) can run simultaneously without conflicts.

---

## File 1: `victim-server.js` (port 3003)

An Express server representing ShopNest's backend.

**Cookie setup:**
On every request to any route, if the `shopper_session` cookie is not already set,
set it: `shopper_session=ShopperJane_t0k3n_ABC456; Path=/`
Do NOT include HttpOnly (intentional — demonstrating the vulnerability).
Add comment: `// ⚠️ VULNERABILITY: HttpOnly omitted — JS can read this cookie`

**Routes:**

`GET /` → serves `victim.html` as a static file.

`GET /search` → This is the vulnerable route. Read `req.query.q` (the search term).
Build an HTML response string by interpolating the raw query value directly into
the page markup. Do NOT sanitize, encode, or escape it in any way.
The reflected value must appear in at least two places in the HTML:
  - The page `<title>` tag: `<title>ShopNest — Search: {q}</title>`
  - A visible heading on the page: `<h2>Search results for: {q}</h2>`

Both injection points must have `// ⚠️ VULNERABILITY: raw req.query.q interpolated into HTML`
and `// ✅ FIX: use a sanitize function to HTML-encode the value before interpolation`.

The search results page must look like a real results page — same header/nav as victim.html,
show 4-6 fake product cards below the heading (hardcoded, same products regardless of query),
and a "Showing N results" count.

`GET /api/products` → returns a JSON array of 6 fake products. Each product has:
id, name, price, category, rating, imageEmoji (use emojis as placeholder images).
Products should be realistic: electronics, clothing, home goods. Mix of categories.

Serve static files from the `reflected/` directory for victim.html and any assets.

**Startup log:**
```
ShopNest victim server running on http://localhost:3003
Vulnerable route: http://localhost:3003/search?q=<YOUR_PAYLOAD>
```

---

## File 2: `attacker-server.js` (port 3004)

**Routes:**

`GET /steal` → same pattern as stored demo. Read `req.query.c`, store with timestamp,
respond with 1x1 transparent GIF + `Cache-Control: no-store`.

`GET /api/stolen` → returns JSON array of stolen cookies, newest first.

`GET /` → serves `attacker.html`.

**CORS:** enable for all origins.

**Pre-generate the malicious URLs on startup** and log them to console:

```
=== ATTACK URLS (copy into phishing email) ===
[Script tag]  http://localhost:3003/search?q=<script>...</script>
[IMG onerror] http://localhost:3003/search?q=<img src=x onerror=...>
```

Both URLs use `new Image().src` to exfiltrate `document.cookie` to port 3004.
Use `encodeURIComponent(document.cookie)` in the payload.

---

## File 3: `victim.html` — ShopNest Storefront

Design: Clean, modern e-commerce look. Color scheme: white background, deep teal (#0d6e6e)
for header and accents. Fake logo: "ShopNest 🛒".

**Header:** Logo left, navigation center (Categories, Deals, New Arrivals, Help),
cart icon + account icon right.

**Hero search bar:** Large centered search input with a "Search" button.
On submit, navigates to `/search?q=<input value>` via GET form action.
This is the normal, legitimate use of the search — users are expected to use it.

**Product grid below:** Fetch `GET /api/products` and render 6 product cards.
Each card: emoji as image, product name, price, star rating, "Add to Cart" button.

**Yellow demo banner** at top (same style as stored demo):
`⚠️ Demo: Your session cookie is: <document.cookie dynamically rendered here>`

This makes the stolen value visible so the user watching the demo can track it.

**Important:** victim.html is a static file — it has no XSS. The vulnerability is
entirely in the server-rendered `/search` route response, not in this file.

---

## File 4: `attacker.html` — Attacker Dashboard

Design: Split into two equal panels side by side.

### Left panel — Phishing Email Composer

Title: "Step 1: Craft the Lure"

A form with:
- Input: "Product / Search Term" (e.g., "wireless headphones")
- Dropdown: "Email Template" — options: "Deal Alert", "Saved Search Update", "Price Drop"
- Button: "Generate Phishing Email"

On click, render a **realistic fake email** in a styled email-client preview below the form.
The email must look like a real marketing email from ShopNest:
- From: deals@shopnest-alerts.com
- Subject line matches the template
- ShopNest logo and branding in the email body
- A product teaser section with fake product names
- A prominent CTA button "View Your Results →"
- The CTA button's `href` is the malicious URL with the `?q=` payload
- Fine print at the bottom with a fake unsubscribe link

The malicious URL embedded in the CTA must be visible in a "Raw URL" field below the email
preview so the demo observer can inspect it.

Show both payload variants as tabs: "Script Tag" and "IMG onerror".

### Right panel — Cookie Collector

Title: "Step 2: Wait for the Victim"

Identical behavior to the stored demo attacker panel:
- Poll `GET /api/stolen` every 1.5 seconds
- "Listening on port 3004..." with blinking cursor while empty
- Green flash animation when cookie arrives
- Show each stolen entry with timestamp and full cookie string
- Counter: "Cookies stolen: N"

**Attack flow instructions** at the bottom:
A numbered step list explaining the attack sequence:
1. Generate the phishing email above
2. "Send" it to victim (open victim.html in another tab manually)
3. Victim clicks the CTA link in the email
4. Server reflects the payload into HTML at `/search?q=...`
5. Browser executes the script — cookie appears here

---

## File 5: `package.json`

Name: `xss-reflected-demo`. Scripts: `"victim": "node victim-server.js"`,
`"attacker": "node attacker-server.js"`. Dependencies: `express`, `cors`.

---

## How to Run (comment block at top of both server files)

```
Terminal 1: cd demo-attacked/xss/reflected && npm install && npm run victim
Terminal 2: cd demo-attacked/xss/reflected && npm run attacker

Attack sequence:
1. http://localhost:3003        ← ShopNest storefront (normal use)
2. http://localhost:3004        ← Attacker dashboard — generate phishing email here
3. Click the CTA link in the generated email → lands on /search?q=<payload>
4. Watch the cookie appear on the attacker dashboard
```

---

## Critical Technical Requirement — Server-Side Rendering of the Vulnerability

The XSS in `/search` must happen at the **HTTP response level**, not via client-side JS.
The server must build the HTML string directly with the raw query param and send it
as the response body. Example of the pattern (structure only, not exact code):

```
response body = "<html>...<h2>Search results for: " + req.query.q + "</h2>..."
```

This is fundamentally different from the Stored XSS demo where the payload was injected
via innerHTML in the browser. Here, the payload arrives already embedded in the HTML
that the server sends. The browser never sees "safe HTML that gets mutated" — it receives
"HTML with a script tag already in it" and parses it as such.

This distinction must be visible in the code comment:
```
// ⚠️ VULNERABILITY: Server-Side Reflection — payload embedded in HTML before browser
// receives the response. The browser parses this as legitimate HTML, not injected content.
// ✅ FIX: HTML-encode req.query.q before interpolation.
//         '<' becomes '&lt;', '>' becomes '&gt;', '"' becomes '&quot;'
//         A one-liner: q.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
```

---

## Code Quality

- Every intentional vulnerability: `// ⚠️ VULNERABILITY:` with explanation
- Every fix: `// ✅ FIX:` directly below
- No lorem ipsum. All copy must sound like a real e-commerce product.
- Product names, prices, categories must be realistic.
- The phishing email must be convincing enough that a non-technical person might click it.
