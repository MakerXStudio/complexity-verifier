# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code. Ships a `verify` CLI that orchestrates native + external checks by convention, plus a scaffolder (`verify init` / `verify upgrade-docs`) that drops the checks and agent commands into a project.

## After making changes, run `npm run verify`

`npm run verify` runs `node src/cli.ts` — the orchestrator over the repo's own `verify:*` scripts, which call the built-in checks (`node src/cli.ts lint|format|check-types|complexity|comment-block`). It runs them in parallel and suppresses output unless one fails.

**Fix locally, check in CI.** Run locally, `verify` **auto-fixes** what it can (`oxlint --fix`, `oxfmt`) so you don't waste effort hand-fixing lint/format. Under CI (`CI` env set — both workflows call `npm run verify` via the shared workflow's `lint-script`) the same command is **check-only** and fails if anything isn't already right. Force a mode with `verify --check` / `verify --fix`. (Mode propagates to the `verify:*` child scripts via the `VERIFY_MODE` env, so they carry no `--check`/`--fix` flags — those live only on the root command.)

`verify:comment-block` runs with `--pushback`, so a flagged comment block prints a warning that keeping it pages a human. Take that seriously: delete the comment, or make the code self-explanatory, before reaching for the `context:` escape hatch.
