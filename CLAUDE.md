# @makerx/verify

A `verifyx` CLI that orchestrates native + external code checks by convention, plus a scaffolder (`verifyx init` / `upgrade-docs`) that drops the checks, a `verify` skill (`.claude/skills` + `.agent-skills`), and a `CLAUDE.md`/`AGENTS.md` pointer into a project. See [README.md](./README.md) for the full design and check reference.

## Verification

After making code changes, run `npm run verify` and fix everything it reports before finishing. Don't silence checks or game the metrics.

`npm run verify` runs `verifyx all` — every built-in check (plus any `verify:*` overrides and the test suite) in parallel — and stays silent unless something fails. It auto-fixes lint/format locally and is check-only under CI.

## Working in this repo

- **The CLI binary is `verifyx`, not `verify`** — `verify` is a Windows `cmd` builtin that shadows it under `npm run`/`npx`. The npm _script_ stays named `verify` (so `npm run verify` works) and the package stays `@makerx/verify`. In dev, the `prepare` script (`scripts/dev-verifyx-bin.mjs`) writes a `node_modules/.bin/verifyx` shim pointing at `node src/cli.ts`, so the repo dogfoods `verifyx <check>` from source; run the CLI directly with `node src/cli.ts <check>`.
