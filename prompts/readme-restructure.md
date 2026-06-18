# Restructure All 16 Attack READMEs to Unified Format

## Objective

Every attack README must follow the same section order and section names.
**Do not delete any content.** Move and rename sections only — every existing
sentence, table, code block, and explanation must survive the restructure.

---

## The canonical section order

Every README must follow this exact sequence. Sections marked **[optional]** only
appear if the attack has relevant content for them.

```
# [Attack Name] Demo — [App Name]

## Port Reference

---

## Attack Flow

---

## How to Run

---

## Attack Walkthrough

---

## Protected Demo

---

## Vulnerable Lines

---

## The Fix

---

## Why It Works

---

## Defense Details

---

[attack-specific optional sections — in this order:]
  ## Credentials                       [optional — only if auth is required]
  ## [Bonus demo sections]             [optional — e.g. "Logout — JWT Revocation Demo",
                                                    "Referer Leakage Demo",
                                                    "GET-Based CSRF Variant"]
  ## [Supplementary theory sections]   [optional — e.g. "Why jwt.decode() is dangerous",
                                                    "Why the Frame-Buster Script Fails",
                                                    "Why HttpOnly Doesn't Help",
                                                    "SQL vs NoSQL Injection Comparison",
                                                    "This Demo in Real Frameworks"]
```

Every section must be separated from the next by a `---` divider (blank line,
three dashes, blank line). No exceptions.

---

## Section rename mappings

When you find a section with one of these names, rename it to the canonical name:

| Found as | Rename to |
|----------|-----------|
| `## What It Is` | `## Why It Works` |
| `## What this demonstrates` | `## Why It Works` |
| `## Why These Lines Are Dangerous` | `## Why It Works` |
| `## Fix Explanation` | `## Defense Details` |
| `## Key concepts` | `## Defense Details` |
| `## Key technical notes` | `## Defense Details` |
| `## Key technical note` | `## Defense Details` |
| `## Defense in Depth` | merge as subsection inside `## Defense Details` |
| `## Run the demo` | `## How to Run` (and move before Attack Walkthrough) |
| `## Setup` | `## How to Run` (and move before Attack Walkthrough) |

If a README already has `## Defense Details`, merge `## Key concepts` or
`## Defense in Depth` into it as a sub-section rather than creating a duplicate.

---

## How to Run — standard format

Every `## How to Run` section must follow this exact layout:

```markdown
## How to Run

```bash
cd demo-attacked/[folder]
npm install
```

Three terminals:

```
npm run vulnerable           # :[port]
npm run guide                # :[port]
npm run secure               # :[port]
```
```

For attacks with 4 servers (SSRF), use four terminal lines. For attacks with
two servers only, use two.

---

## Protected Demo — extraction rule

If a README has NO `## Protected Demo` section, look inside `## Attack Walkthrough`
for steps that say things like "Switch to :PORT", "Open localhost:PORT", or
"same payload returns 403/404" referring to the protected server — extract those
steps into a new `## Protected Demo` section placed after `## Attack Walkthrough`.

The walkthrough steps should cover the attack only. Protected Demo steps should
cover verifying the fix only.

---

## Credentials — extraction rule

If login credentials are mentioned anywhere in the README (inline in the walkthrough,
in a table, or in a separate section), collect them into a `## Credentials` table
at the bottom of the file using this format:

```markdown
## Credentials

| User | Password | Role |
|------|----------|------|
| alice | alice123 | developer |
```

If the attack demo has no login screen (e.g. clickjacking, event-loop-blocking,
ssrf, reverse-tabnabbing), skip this section entirely.

---

## Files to restructure

Process all 16 attack READMEs. Read each file before editing.

| File | Notes |
|------|-------|
| `clickjacking/README.md` | "How to Run" is inline inside walkthrough — extract it. No `## Protected Demo` as own section — extract from walkthrough. Keep "Why the Frame-Buster Script Fails", "Defense Details", "How the Attack Works", "Reset Demo State" as optional theory sections at bottom. |
| `command-injection/README.md` | "Run the demo" is after walkthrough — move before. No `## Protected Demo` — extract from walkthrough step 5. |
| `csrf/README.md` | "How to Run" is inline inside walkthrough — extract it. No `## Protected Demo` as own section — steps are inline in walkthrough. Keep "GET-Based CSRF Variant", "Why HttpOnly Doesn't Help", "Fix Explanation"→"Defense Details", "Running Protected vs Vulnerable Side-by-Side", "Defense Summary", "This Demo in Real Frameworks" at bottom. |
| `event-loop-blocking/README.md` | Already has `## How to Run`. No `## Protected Demo` — the protected comparison is embedded in walkthrough steps 3–4 and 7–8; extract those into `## Protected Demo`. Keep "Why setTimeout alone does not help" and "Defense in Depth" merged into `## Defense Details`. |
| `idor/README.md` | "Run the demo" is after walkthrough — move before. No `## Protected Demo` — walkthrough step 6 covers it; extract. |
| `jwt-attacks/README.md` | Already mostly correct. Verify order. Keep "Logout — JWT Revocation Demo" and "Why jwt.decode() is dangerous" at bottom as optional sections. |
| `mass-assignment/README.md` | "Run the demo" is after walkthrough — move before. No `## Protected Demo` — walkthrough step 6 covers it; extract. Rename "Key technical notes" → "Defense Details". |
| `nosql-injection/README.md` | Already has `## How to Run` before walkthrough. Already has `## Protected Demo`. Rename "Why JSON Endpoints Are Specifically Vulnerable" — keep as-is (it's a theory section, leave it named as-is at the bottom). |
| `path-traversal/README.md` | "Run the demo" is after walkthrough — move before. No `## Protected Demo` — walkthrough step 4 covers it; extract. Rename "Key technical note" → "Defense Details". |
| `prototype-pollution/README.md` | Already has `## How to Run`. Already has `## Protected Demo`. Keep "Why This Is Dangerous" — rename to `## Why It Works`. No credentials needed. |
| `reverse-tabnabbing/README.md` | Already has correct order for core sections. The extensive theory sections at the bottom are all optional sections — leave them in place and named as-is. |
| `sql-injection/README.md` | Already has `## Protected Demo` as own section. Verify `## How to Run` placement. "Why Parameterized Queries Work" → keep as-is (it's a theory section). "SQL vs NoSQL Injection" table — keep at bottom. |
| `ssrf/README.md` | Port Reference and walkthrough already fixed (4 servers). Verify all other sections. "Why This Attack Is Dangerous", "Why the Denylist Is Insufficient", "Defense Details", "Internal API Endpoints" all stay at bottom as optional sections. |
| `xss/stored/README.md` | Missing `---` dividers — add after Port Reference and Attack Flow. No `## How to Run` as separate section — extract from numbered steps. Rename `## What It Is` → `## Why It Works`. Rename `## Why These Lines Are Dangerous` — merge into `## Why It Works`. "Payload Variants", "Edge Cases", "This Demo in Real Frameworks" stay at bottom. |
| `xss/reflected/README.md` | Same as stored: add missing `---` dividers, extract `## How to Run`, rename `## What It Is` → `## Why It Works`. "Edge Cases", "This Demo in Real Frameworks" stay at bottom. |
| `xss/svg-upload/README.md` | Same as stored: add missing `---` dividers, extract `## How to Run`, rename `## What It Is` → `## Why It Works`. "Defense Details (Expanded)" → rename to `## Defense Details`. "Edge Cases", "This Demo in Real Frameworks" stay at bottom. |

---

## What NOT to change

- Do not delete or rewrite any content — restructure only
- Do not change the text inside sections — only move and rename the section headings
- Do not touch `## Vulnerable Lines` or `## The Fix` content — already correct
- Do not touch `## Port Reference` content — already correct
- Do not touch `## Attack Flow` diagrams
- Do not add `---` dividers inside sections — only between top-level sections
- Do not change any code blocks
