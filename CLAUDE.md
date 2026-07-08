# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code. Ships a `verifyx` CLI that orchestrates native + external checks by convention, plus a scaffolder (`verifyx init` / `verifyx upgrade-docs`) that drops the checks and agent commands into a project.

**The CLI binary is `verifyx`, not `verify`.** `verify` is a Windows `cmd` builtin, and `npm run` bodies + `npx` resolve through `cmd` there, so a bare `verify` runs the builtin. `verifyx` (verify + fix) avoids that on all platforms. The npm **script** stays named `verify` (`npm run verify` is a script lookup, not command resolution) and the package stays `@makerx/verify`. Locally, `prepare` (`scripts/dev-verifyx-bin.mjs`) writes a `node_modules/.bin/verifyx` shim → `node src/cli.ts`, so the repo's own `verify:*` scripts call `verifyx <check>` exactly like a consumer's; `prepare` never runs for registry consumers.

## After making changes, run `npm run verify`

`npm run verify` runs `verifyx` — the orchestrator over the repo's own `verify:*` scripts, which call the built-in checks (`verifyx lint|format|check-types|complexity|comment-block|…`). It runs them in parallel and suppresses output unless one fails. Bare `verifyx` runs **only** the defined `verify:*` scripts (nothing if none); `verifyx all` runs **every** built-in check, with a `verify:<name>` script overriding its matching built-in.

**Fix locally, check in CI.** Run locally, `verifyx` **auto-fixes** what it can (`oxlint --fix`, `oxfmt`) so you don't waste effort hand-fixing lint/format. Under CI (`CI` env set — both workflows call `npm run verify` via the shared workflow's `lint-script`) the same command is **check-only** and fails if anything isn't already right. Force a mode with `verifyx --check` / `verifyx --fix`. (Mode propagates to the `verify:*` child scripts via the `VERIFY_MODE` env, so they carry no `--check`/`--fix` flags — those live only on the root command.)

`verify:comment-block` runs with `--pushback`, so a flagged comment block prints a warning that keeping it pages a human. Take that seriously: delete the comment, or make the code self-explanatory, before reaching for the `context:` escape hatch.
