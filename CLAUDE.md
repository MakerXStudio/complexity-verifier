# @makerx/complexity-verifier

A maintainability-index + comment-block checker that gives AI agents back-pressure against writing hard-to-maintain code. Node >= 24; run the CLI from source with `node src/cli.ts`.

## After making changes, run `npm run verify`

`npm run verify` runs (via `run-p`) `lint:fix`, `format`, and `verify:complexity` — the tool checking its own source. Fix anything it reports before finishing.

`verify:complexity` runs with `--comment-block-pushback`, so a flagged comment block prints a warning that keeping it pages a human. Take that seriously: delete the comment, or make the code self-explanatory, before reaching for the `context:` escape hatch.

## Conventions

- Comments explain _why_, not _what_. No comment block longer than 2 lines unless it is JSDoc (`/**`) or prefixed `context:`.
- Keep functions small so files stay above the MI threshold; the fix for a failing file is to split it, never to game the metric.
- Tests are co-located `*.test.ts` (vitest).
