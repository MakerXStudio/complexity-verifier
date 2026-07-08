---
name: verify
description: Run this project's code verifications (@makerx/verify) and fix what they report. Use before considering any code change complete, when asked to "verify", "run checks", or "run verify".
---

# verify

This project uses [`@makerx/verify`](https://github.com/MakerXStudio/verify) — a collection of code
verifications that give AI coding agents back-pressure against writing hard-to-maintain code.

## How to run

Run the project's verifications via its npm script or `npx verify` (a pinned dev dependency — never a global install):

```
npx verify
```

- With no `verify:*` scripts defined, `verify` runs the built-in default checks in their default modes.
- With `verify:*` scripts defined, `verify` runs those in parallel; output is suppressed unless a check fails.
- Run a single built-in directly, e.g. `npx verify complexity` or `npx verify knip`.
- `npx verify list` shows every built-in check.

## Working with failures

1. Read each failure carefully — it explains what is wrong and how to fix it.
2. Fix the underlying issue. For complexity failures, **split the file**; do not game the metric by deleting
   comments, joining lines, or shortening names.
3. Re-run `verify` until it passes.
4. Do not bypass checks with `--warn`, and reach for escape hatches (like `context:` comments) only as a last resort.
