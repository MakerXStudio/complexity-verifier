# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code. Ships a `verify` CLI that orchestrates native + external checks by convention, plus a scaffolder (`verify init` / `verify upgrade-docs`) that drops the checks and agent commands into a project. Node >= 24; run the CLI from source with `node src/cli.ts`.

## After making changes, run `npm run verify`

`npm run verify` runs `node src/cli.ts` — the orchestrator over the repo's own `verify:*` scripts, which call the built-in checks (`node src/cli.ts lint|format|check-types|complexity|comment-block`). It runs them in parallel and suppresses output unless one fails.

**Fix locally, check in CI.** Run locally, `verify` **auto-fixes** what it can (`oxlint --fix`, `oxfmt`) so you don't waste effort hand-fixing lint/format. Under CI (`CI` env set — both workflows call `npm run verify` via the shared workflow's `lint-script`) the same command is **check-only** and fails if anything isn't already right. Force a mode with `verify --check` / `verify --fix`. (Mode propagates to the `verify:*` child scripts via the `VERIFY_MODE` env, so they carry no `--check`/`--fix` flags — those live only on the root command.)

`verify:comment-block` runs with `--pushback`, so a flagged comment block prints a warning that keeping it pages a human. Take that seriously: delete the comment, or make the code self-explanatory, before reaching for the `context:` escape hatch.

## Architecture

- `src/cli.ts` — commander root program. Default action (no subcommand) = `orchestrate()`. Each built-in is a subcommand; plus `init`, `upgrade-docs`, `list`.
- `src/checks/` — one module per check + `registry.ts` (the `CHECKS` array). Native checks run in-process; external checks (`external.ts`) shell out and skip when the tool is absent.
- `src/orchestrator/` — the convention: `resolveEntries` finds `verify:*` scripts; if present, `run.ts` runs them in parallel; if absent, `runDefaults.ts` runs the built-in default set in-process.
- `src/scaffold/` — `init.ts` (pure), `agentFiles.ts` + `writeManaged.ts` (idempotent agent-file emission), `packageScripts.ts`.
- `src/shared/` — `color`, `git`, `diff`, `comment-scan` (TS compiler API — no ts-morph), `config`, `spawn`.
- `templates/` — shipped agent files (`.claude` command + skill), read at runtime relative to the module; listed in package.json `files`.

## Conventions

- Comments explain _why_, not _what_. No comment block longer than 2 lines unless it is JSDoc (`/**`) or prefixed `context:`.
- Keep functions small so files stay above the MI threshold; the fix for a failing file is to split it, never to game the metric.
- `console` is only allowed in the CLI's reporting surface (`src/cli.ts`, `src/report.ts`, `src/commands/**`, `src/orchestrator/**`, `src/checks/**`) — see `.oxlintrc.json`.
- Prefer the TypeScript compiler API and existing `src/shared` helpers over new dependencies.
- Tests are co-located `*.test.ts` (vitest).
