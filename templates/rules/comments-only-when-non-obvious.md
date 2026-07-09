# Comment only when the code would mislead a competent reader

Write self-documenting code: let well-named identifiers, narrow types, and small functions carry the meaning.
Add a comment only when reading the code alone would make a competent reader mispredict its behaviour, and only
to explain the _why_ the code itself cannot show.

## When a comment earns its place

Add one — kept to a single line where you can — for exactly these:

- A non-obvious workaround: a specific bug, race, ordering hazard, or platform quirk the code is shaped around.
- A constraint imposed by an external system not visible in the code: an API contract, a wire format, a rate
  limit, a required call order.
- A deliberate deviation from the obvious approach, where the obvious approach is wrong for a reason a reader
  would not guess.

**The keep-it test:** if a competent reader would predict the behaviour correctly without the comment, delete it.

## What never to write

- **Prose blocks on trivial code.** A one-liner, an assignment, or a single call never gets a multi-line comment.
- **Restatement.** A comment that re-says what the next line already says in code is noise; the code is the
  source of truth, and a description of it rots and misleads.
- **Session narration.** Never write the editing session's reasoning into the file: `let me…`, `now I'll…`, `as
requested`, `this function does…`, `first,` / `next,`. That belongs in the chat, not the code.
- **LLM tells.** Em-dashes and curly quotes (`—`, `“ ” ‘ ’`) in a comment are a strong sign it was generated
  narration rather than a deliberate note.
- **Duplicated explanation.** State a fact once, at its source of truth; a second site gets a one-line pointer,
  not a copy.

## Examples

Restatement / prose block — delete it; the code already says this:

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
// GOOD
// context: Stripe rejects sub-cent precision — round to integer cents before sending.
const amountCents = Math.round(price * 100)
```

Session narration — strip it:

```ts
// BAD
// Now let me add the retry logic that was requested. This wraps the call in a loop
// and backs off exponentially.
for (let attempt = 0; attempt < maxRetries; attempt++) { … }

// GOOD
for (let attempt = 0; attempt < maxRetries; attempt++) { … }
```

## The two escape hatches

Two things are always allowed and never need pruning:

- **JSDoc** (`/** … */`).
- A comment whose first line starts with **`context:`** — the marker for durable context the code cannot
  express. Use it only for a genuinely necessary _why_; it is not a way to keep a restatement.

Machine directives (`eslint-disable`, `@ts-expect-error`, `prettier-ignore`, …) are exempt too.

## Enforcement

This is gated, not merely advised. `verifyx comments` flags low-value comments — long blocks, session narration,
and high comment density — over the current diff (or the whole codebase with `--scope all`). An edit-time
PostToolUse hook (`verifyx comments-hook`) applies the same rules the moment a file is edited. The
`prune-comments` skill strips and consolidates comments across a change on demand.
