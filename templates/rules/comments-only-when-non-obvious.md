---
paths:
  - '*.{ts,tsx,cts,mts,js,jsx,mjs,cjs,yml,yaml}'
  - '**/*.{ts,tsx,cts,mts,js,jsx,mjs,cjs,yml,yaml}'
---

# Comment only when the code would mislead a competent reader

Write self-documenting code: let well-named identifiers, narrow types, and small functions carry the meaning. Add a comment only when reading the code alone would make a competent reader mispredict its behaviour, and only to explain the _why_ the code itself cannot show.

## When a comment earns its place

Add one — kept to a single line where possible — for exactly these:

- A non-obvious workaround: a specific bug, race, ordering hazard, or platform quirk the code is shaped around.
- A constraint imposed by an external system not visible in the code: an API contract, a wire format, a rate limit, a required call order.
- A deliberate deviation from the obvious approach, where the obvious approach is wrong for a reason a reader would not guess.

The keep-it test: if a competent reader would predict the behaviour correctly without the comment, delete the comment.

## What never to write

These are the failure modes this rule exists to stop. They are the current default-model drift, and they poison codebases at scale.

- **Prose blocks on trivial code.** A one-liner, an assignment, or a single call never gets a multi-line comment. A paragraph above one statement is the dominant failure.
- **Restatement.** A comment that re-says what the next line already says in code is noise, not signal. The code is the source of truth; a description of it rots and must then be re-verified by every reader.
- **Leaked session narration.** Never write the editing session's ephemeral reasoning into code or to disk: `Let me…`, `Now I'll…`, `This is a substantial change…`, `we need to…`, `as requested`. That belongs in the chat, never the file.
- **LLM tells.** Em-dashes and curly quotes (`—`, `“ ” ‘ ’`) in a comment are a strong sign it was generated narration rather than a deliberate note; the gate flags them.
- **Invented shorthand.** Do not coin a new term, abbreviation, or naming scheme inside a comment and leave it undefined; it snowballs and is never cleaned up. Use the codebase's existing vocabulary.
- **Duplicated explanation.** State a fact once, at its source of truth (the README, or the single function that owns it). A second site gets a one-line pointer, not a copy — the same explanation restated across many files is the same bug as restatement, spread out.

## Examples

Restatement and a prose block — delete it; the code already says this:

```ts
// BAD
// Calculate the total by multiplying quantity by unit price, then store it so the
// invoice summary can use it later when it renders the line item.
const total = quantity * unitPrice

// GOOD
const total = quantity * unitPrice
```

A justified comment — keep it; the constraint is external and invisible in the code:

```ts
// GOOD: Stripe rejects sub-cent precision; round to integer cents before sending.
const amountCents = Math.round(price * 100)
```

Leaked session narration — strip it:

```ts
// BAD
// Now let me add the retry logic that was requested. This is the substantial
// part of the change: wrap the call in a loop and back off exponentially.
for (let attempt = 0; attempt < maxRetries; attempt++) { ... }

// GOOD
for (let attempt = 0; attempt < maxRetries; attempt++) { ... }
```

Config and infra are not exempt — the same restatement shows up in YAML:

```yaml
# BAD: the key and its default already say this
# The log level for the service, defaulting to info.
logLevel: info

# GOOD
logLevel: info
```

Duplicated explanation — say it once, point to it:

```text
BAD:  the full paragraph on how the retry budget is derived is copied into the
      README, the client, and four call sites.
GOOD: the explanation lives once in the client; each call site carries
      // retry budget: see resolveRetryBudget
```

## Enforcement

This is gated, not merely advised. `verifyx comments` flags low-value comments — long blocks, session narration, and high comment density — over the current diff (or the whole codebase with `--scope all`). An edit-time PostToolUse hook (`verifyx comments-hook`) applies the same rules the moment a file is edited. The `prune-comments` skill strips and consolidates comments across a change on demand.
