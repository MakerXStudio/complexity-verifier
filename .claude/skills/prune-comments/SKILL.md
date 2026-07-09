---
name: prune-comments
description: Remove low-value code comments across the current change. Use when asked to "prune comments", "clean up comments", or after the verify comments check flags narration, dense comments, or long comment blocks.
---

Capable coding agents love to narrate their work in comments. This skill removes that noise
from the current change while protecting the comments that genuinely earn their place.

## 1. Find the flagged comments

Run the comments check over the branch diff (the binary is `verifyx`, since `verify` is a
Windows builtin):

```
npx verifyx comments --block-new-comments --pushback
```

That lists every comment on a changed line. For a softer pass that only flags narration and
dense comment runs (the defaults), drop `--block-new-comments`.

## 2. Delete or keep — the criteria

**Delete** a comment when any of these hold:

- It narrates _what_ the next line does (`// increment the counter`, `// return the result`).
- It narrates the editing session (`// let me add a handler`, `// as requested`, `// now we…`).
- It restates a name already in the code (`// user service` above `class UserService`).
- It is a commented-out block of old code.
- Removing it loses nothing a competent reader couldn't recover from the code itself.

**Keep** a comment when it explains _why_, not _what_:

- A non-obvious constraint, workaround, or business rule (`// Stripe rejects amounts under 50c`).
- A deliberate deviation a reader would otherwise "fix" and break.
- A link to an issue/spec that explains a surprising choice.

If a kept comment is genuinely durable context the code cannot express, prefix its first line
with `context:` so the check leaves it alone:

```ts
// context: retries must stay at 3 — the upstream gateway drops the connection after the 4th.
```

Machine directives (`eslint-disable`, `@ts-expect-error`, …) and JSDoc (`/** … */`) are
always allowed and never need pruning.

## 3. Prefer fixing the code over keeping the comment

When a comment exists because the code is unclear, the better fix is usually to rename a
variable, extract a well-named function, or simplify — then delete the comment. Reach for
`context:` only when the code truly cannot carry the meaning.

## 4. Re-run until clean

After editing, run the check again and repeat until it passes. Do not silence the check,
widen its ignore globs, or mark low-value comments `context:` to slip them past the gate —
`context:` pages a human to approve the comment.
