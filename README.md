# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code — and improve code quality for everyone.

`verify` ships both:

- a **CLI** that orchestrates a set of checks by convention, and
- the **agent commands / skills** (`.claude/`, `.agent-skills/`) that steer AI assistants to run those checks and fix what they report.

Complexity was the first check. It is now just one of several, and the set grows over time.

## Install

Install as a **pinned dev dependency** — never globally. A locked version means the exact same tool runs on your machine and in CI/CD:

```sh
npm install --save-dev @makerx/verify
```

Requires Node.js >= 24. Invoke it via an npm script or `npx verifyx` — not a global binary on `PATH`.

The quickest way to wire it into a project:

```sh
npx verifyx init
```

> ### Why is the command `verifyx`, not `verify`?
>
> The package is `@makerx/verify`, but the CLI binary is **`verifyx`**. `verify` is a built-in `cmd.exe`
> command on Windows, and both `npm run` script bodies and `npx` resolve commands through `cmd` there — so a
> bare `verify` runs the Windows builtin ("VERIFY is off."), not this tool. Renaming the binary to `verifyx`
> (a nod to the fact it **fixes** as well as verifies) makes every invocation — `npx verifyx`, npm scripts,
> and a typed `verifyx` — work identically on macOS, Linux, and Windows. Your npm **script** can still be named
> `verify` (that's a script lookup, not command resolution), so `npm run verify` works everywhere.

## How `verifyx` decides what to run

Running `verifyx` with no subcommand follows a convention:

- **No `verify:*` scripts in `package.json`** → it runs the **built-in default checks** in their default modes. Each check degrades gracefully — it passes or skips when it does not apply (no files, no diff, tool not installed, no rules configured).
- **`verify:*` scripts present** → it runs **those** in parallel. Output from each is buffered and shown **only if it fails**, keeping passing runs quiet (and quieter still under Claude Code). Add `--verbose` to stream everything.

You take control by adding `verify:*` scripts. Prefer calling the built-ins (`verifyx <check>`) so their fix-vs-check behaviour stays centralised; drop to a raw command only for something bespoke:

```jsonc
{
  "scripts": {
    "verify": "verifyx",
    "verify:complexity": "verifyx complexity --threshold 50 \"src/**/*.ts\"",
    "verify:lint": "verifyx lint",
    "verify:custom": "node ./scripts/my-check.mjs",
  },
}
```

Run a single built-in directly: `verifyx complexity`, `verifyx knip`, … and `verifyx list` shows them all.

### Fix locally, check in CI

Fixable checks (`lint`, `format`) **auto-fix by default** so the person — or AI agent — running `verifyx` locally doesn't burn effort hand-fixing lint and formatting. When `CI` is set (as CI systems do), the same command is **check-only** and **fails** instead of rewriting, so a PR can't pass with unformatted or unlinted code. Override explicitly with `verifyx --fix` or `verifyx --check`.

Flags on the bare `verifyx` command:

- `--check` / `--fix` — force check-only or auto-fix (defaults: fix locally, check under CI).
- `--measure` — print a status/duration summary table.
- `--all` — run every `verify:*` script, ignoring diff-based filters.
- `--verbose` — stream all output instead of suppressing passing runs.

## Built-in checks

| Check               | Kind     | What it catches                                                                                                                             |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `complexity`        | native   | Maintainability-index gate (cyclomatic complexity + Halstead volume + SLOC). Fails files below a threshold.                                 |
| `comment-block`     | native   | Comment blocks longer than the limit. JSDoc (`/**`) and `context:`-prefixed blocks are exempt.                                              |
| `block-comments`    | native   | Any comment added to a line changed against `HEAD`. Machine directives (`eslint-disable`, `@ts-expect-error`, …) and `context:` are exempt. |
| `hardcoded-colors`  | native   | Literal hex / `0x` colour values in source (cross-platform; suggests using design tokens).                                                  |
| `forbidden-strings` | native   | Disallowed JSON config values, from rules in your verify config.                                                                            |
| `lint`              | external | Lint — auto-fixes locally, checks in CI ([oxlint](https://oxc.rs)).                                                                         |
| `format`            | external | Formatting — writes locally, checks in CI ([oxfmt](https://oxc.rs)).                                                                        |
| `check-types`       | external | TypeScript type check (`tsc --noEmit`); skips when there is no `tsconfig.json`.                                                             |
| `knip`              | external | Unused files, exports and dependencies ([knip](https://knip.dev)).                                                                          |
| `circular-deps`     | external | Circular dependencies ([skott](https://github.com/antoine-coulon/skott)).                                                                   |
| `duplicate-code`    | external | Copy-paste detection ([jscpd](https://github.com/kucherenko/jscpd)).                                                                        |

External checks shell out to their tool and **skip gracefully when it is not installed** — `verifyx init` installs the ones you opt into. They run the tool from your local `node_modules/.bin` regardless of how `verifyx` was invoked. `oxlint`/`oxfmt`/`tsc` are resolved if present; the rest are declared as optional `peerDependencies`.

### `complexity`

```sh
verifyx complexity --threshold 50 "src/**/*.ts"
```

- `[pattern]` — glob, directory, or file. Defaults to `{src,server,shared}/**/*.ts`.
- `--threshold <n>` — fail when any file's minimum maintainability index is below `n`.
- `--ignore <glob>` — exclude files (repeatable; appended to the default `**/*test.ts*`).

A file's score is the **minimum MI across its functions**. When exactly one file matches, a detailed per-function breakdown is printed instead of the gate — handy for diagnosing one file at a time. **Fix a failure by splitting the file**, not by gaming the metric (deleting comments, joining lines, shortening names).

### `comment-block`

```sh
verifyx comment-block --max-lines 2 --pushback "src/**/*.ts"
```

- `--max-lines <n>` — fail on comment blocks longer than `n` lines (default 2).
- `--pushback` — add AI back-pressure framing to the failure (keeping the comment "pages a human").
- `--warn` — report without failing.
- `--ignore <glob>` — exclude files (repeatable).

Prefix a comment's first line with `context:` to keep genuinely durable context:

```ts
// context: the upstream API returns seconds, not milliseconds — do not "fix" this
const timeoutMs = timeout * 1000
```

## Scaffolding a project

### `verifyx init`

Interactively wire verifications and agent files into the current project:

```sh
verifyx init
```

It lets you multi-select **checks** and **agent targets** (Claude `.claude/`, and/or cross-vendor `.agent-skills/`), then:

- writes the selected `verify:*` scripts to `package.json` (never clobbering existing ones),
- installs the external checks' tools as `--save-dev`,
- emits the agent command/skill files.

Options:

- `--defaults-only` — do **not** write `verify:*` scripts; rely on `verify`'s built-in defaults (still installs opted-in tools and writes agent files).
- `--yes` — non-interactive; use `--select <name>` (repeatable), `--no-claude`, `--agents`.

### `verifyx upgrade-docs`

Idempotently create/refresh the managed agent files (created / updated / unchanged; refuses to write through symlinks):

```sh
verifyx upgrade-docs             # both targets
verifyx upgrade-docs --no-agents  # only .claude/
```

## Configuration

Some checks read per-repo config from `verify.config.json`, or a `verify` key in `package.json`:

```jsonc
{
  "verify": {
    "blockComments": { "ignore": ["**/*.generated.ts"] },
    "hardcodedColors": { "root": "src", "ignore": ["**/tokens.ts"] },
    "forbiddenStrings": [{ "file": "app.json", "paths": ["env.LOG_LEVEL"], "disallowed": "debug" }],
    "filters": { "verify:web": "web/**" },
  },
}
```

`filters` scopes a `verify:*` script to a diff glob: it is skipped unless a changed file matches (bypass with `verifyx --all`).

## CI/CD

Because it is a pinned dev dependency, CI runs the identical tool:

```yaml
- run: npm ci
- run: npm run verify
```

## Programmatic API

```ts
import { analyzeComplexity, orchestrate, CHECKS } from '@makerx/verify'

const { failing, passed } = analyzeComplexity({ pattern: 'src/**/*.ts', threshold: 50 })
```

Exports include `analyzeComplexity`, the check registry (`CHECKS`, `getCheck`, `defaultChecks`), `orchestrate`, `runDefaults`, `applyInit`, `loadVerifyConfig`, the individual `run*` check functions, and the lower-level complexity helpers (`calculateCyclomaticComplexity`, `calculateHalstead`, `calculateMaintainabilityIndex`, `countSloc`, `scoreFiles`, `findSourceFiles`, `forEachFunction`).

## The maintainability index formula

```
MI = 171 - 5.2 * ln(HalsteadVolume) - 0.23 * CyclomaticComplexity - 16.2 * ln(SLOC)
```

Clamped to 0–100. Rough interpretation: **> 65** good, **50–65** moderate, **< 50** hard to maintain.

## Attribution

The `verify` runner, `block-comments`, `hardcoded-colors`, and `forbidden-strings` checks are ported from [staff0rd/assist](https://github.com/staff0rd/assist); the maintainability metrics originate there too. The idempotent agent-file scaffolding follows the MakerX data-streams CLI's `upgrade-docs`. See [Steering the Vibe: Verify](https://staffordwilliams.com/blog/2025/12/14/steering-the-vibe-verify/) and [Complexity](https://staffordwilliams.com/blog/2026/02/22/steering-the-vibe-complexity/).

## License

MIT
