---
name: prune-comments
description: Strip low-value comments (restatement, session narration, prose blocks, dense runs) from a change. Applies edits in-place, file by file. Use when asked to "prune comments", "clean up comments", "remove comment bloat", or after the verify comments check flags them. Apply-capable — it edits files, it is not a read-only review.
---

# prune-comments

Remove comment bloat and keep only the comments that earn their place, following the criteria in the
`comments-only-when-non-obvious` rule (`.claude/rules/` / `.agent-skills/rules/`). Edits are applied in-place.

## 1. Find the flagged comments

Run the check to see what fails (the binary is `verifyx`). By default it judges the **current diff** — the
comments this change introduced:

```
npx verifyx comments --pushback
```

Scope options (`verifyx comments` handles the git/diff scoping itself — you don't need to compute it):

- **Whole repo:** `npx verifyx comments --scope all --pushback` — audit and prune every comment in the codebase,
  not just the diff.
- **Every comment, not just heuristic hits:** add `--block-all` (with either scope) to remove _every_ comment in
  scope, not just the heuristic hits.

## 2. Delete or keep

Apply the `comments-only-when-non-obvious` rule to each flagged comment:

- **Delete** restatement, session narration (`let me…`, `as requested`, `this function does…`), prose blocks on
  trivial code, LLM tells (em-dash / curly quotes), and duplicated explanation. When in doubt, delete.
- **Keep** only a non-obvious _why_: a workaround, an external constraint, or a deliberate non-obvious deviation.

Prefer fixing the code over keeping the comment: a better name, a smaller function, or a narrower type often
removes the need for the comment entirely. Do not try to slip a low-value comment past the gate — remove it, or
make the code self-explanatory.

## 3. Apply and re-run

Edit with the Edit tool — one edit per change site, not a whole-file rewrite. Then re-run the same
`verifyx comments` command and repeat until it passes. Never silence the check or widen its ignore globs.

## Output

One line per file: `pruned: <file> — <n> removed`, `clean: <file>`, or `needs manual review: <file>`.
No preamble, no closing remarks.
