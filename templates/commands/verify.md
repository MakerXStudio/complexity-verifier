---
description: Run all verifications and fix everything they report
---

Run this project's verifications. Prefer the npm script, which works on every platform:

```
npm run verify
```

(or invoke the binary directly with `npx verifyx` — the CLI is named `verifyx`, not `verify`, because `verify` is a Windows `cmd` builtin; see the project README. Never use a global binary.)

If anything fails:

- Fix every reported issue, then run it again. Repeat until it passes cleanly.
- Do **not** silence failures with `--warn`, and do not delete or weaken checks to make them pass.
- Treat escape hatches (like a `context:` comment prefix) as a last resort — prefer making the code self-explanatory.

The point of these checks is back-pressure: they exist to stop hard-to-maintain code from landing. Take them seriously.

ARGUMENTS: $ARGUMENTS
