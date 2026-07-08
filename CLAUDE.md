# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code. Ships a `verify` CLI that orchestrates native + external checks by convention, plus a scaffolder (`verify init` / `verify upgrade-docs`) that drops the checks and agent commands into a project. Node >= 24; run the CLI from source with `node src/cli.ts`.

## After making changes, run `npm run verify`

`npm run verify` runs `node src/cli.ts` — the tool checking its own source. With `verify:*` scripts defined in `package.json`, the orchestrator runs them in parallel and suppresses output unless one fails. The `verify:*` scripts are all **non-editing** (`verify:lint` = `oxlint .`, `verify:format` = `oxfmt --check .`, plus `verify:check-types`, `verify:complexity`, `verify:comment-block`) so the same command runs safely in CI (both workflows call `npm run verify` via the shared workflow's `lint-script`). To auto-fix lint/format locally, run `npm run fix` (`lint:fix` + `format`), then `npm run verify`.

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
