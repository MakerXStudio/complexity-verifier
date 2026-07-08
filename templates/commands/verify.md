---
description: Run all verifications and fix everything they report
---

Run this project's verifications with `npx verify $ARGUMENTS 2>&1` (or the project's `verify` npm script — never the global binary).

If anything fails:

- Fix every reported issue, then run `verify` again. Repeat until it passes cleanly.
- Do **not** silence failures with `--warn`, and do not delete or weaken checks to make them pass.
- Treat escape hatches (like a `context:` comment prefix) as a last resort — prefer making the code self-explanatory.

The point of these checks is back-pressure: they exist to stop hard-to-maintain code from landing. Take them seriously.

ARGUMENTS: $ARGUMENTS
