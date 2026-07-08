# @makerx/verify

A growing collection of code **verifications** that give AI coding agents back-pressure against writing hard-to-maintain code — and improve code quality for everyone.

`verify` ships both:

- a **CLI** that orchestrates a set of checks by convention that are designed to be executed by AI agents as well as CI servers, and
- a **verify skill** (`.claude/skills/`, `.agent-skills/`) + a one-line `CLAUDE.md`/`AGENTS.md` pointer that steer AI assistants to run those checks and fix what they report.

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

There are three ways to invoke it, from "my curated gate" to "one specific check":

| Command           | What it runs                                                                            |
| ----------------- | --------------------------------------------------------------------------------------- |
| `verifyx`         | Your project's `verify:*` scripts — the gate you curate. No `verify:*` scripts → nothing runs. |
| `verifyx all`     | Every built-in check, with default options.                                             |
| `verifyx <check>` | A single built-in, e.g. `verifyx complexity`. `verifyx list` shows them all.            |

### `verifyx` — your curated gate

`verifyx` with no subcommand is what you run day-to-day and in CI. It runs every `verify:*` script in `package.json` **in parallel**, and nothing implicit — the scripts you define **are** the gate.

A clean run is **completely silent**: no preamble, no per-script output, just exit `0`. Each script's output is buffered and printed **only if that script fails**, so `verifyx` is cheap to run in a loop or hand to an agent. (`--verbose` streams everything as it runs; `--measure` prints a status/duration table.)

You curate the gate by adding `verify:*` scripts. Prefer calling the built-ins (`verifyx <check>`) so their fix-vs-check behaviour stays centralised; drop to a raw command only for something bespoke:

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

### `verifyx all` — run every built-in

`verifyx all` skips your curated list and runs **every** built-in check with its default options — a quick "run everything" without wiring up scripts. Where you've defined a `verify:<name>` script, it **overrides** the matching built-in, so you can swap one check's implementation without redefining the rest — e.g. `"verify:lint": "eslint ."` makes `verifyx all` use ESLint for the lint step.

### Fix locally, check in CI

Fixable checks (`lint`, `format`) **auto-fix by default** so the person — or AI agent — running `verifyx` locally doesn't burn effort hand-fixing lint and formatting. When `CI` is set (as CI systems do), the same command is **check-only** and **fails** instead of rewriting, so a PR can't pass with unformatted or unlinted code. Force a mode with `verifyx --fix` or `verifyx --check`.

To give a script-based override that same split, pair a `verify:<name>` (check-mode) script with a `verify:<name>:fix` variant. `verifyx` runs the `:fix` variant locally and the base script in CI — never both — so even an override wrapping a tool that doesn't know about fix-vs-check still fixes locally and only checks in CI:

```jsonc
{
  "scripts": {
    "verify:lint": "eslint .",
    "verify:lint:fix": "eslint . --fix",
  },
}
```

Flags on the bare `verifyx` command:

- `--check` / `--fix` — force check-only or auto-fix (defaults: fix locally, check under CI).
- `--measure` — print a status/duration summary table.
- `--verbose` — stream all output instead of suppressing passing runs.

## Built-in checks

| Check               | Kind     | What it catches                                                                                                                                                                                                                           |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `complexity`        | native   | Maintainability-index gate (cyclomatic complexity + Halstead volume + SLOC). Fails files below a threshold.                                                                                                                               |
| `comments`          | native   | Comment blocks longer than the limit (JSDoc / `context:` exempt); with `--block-new-comments`, also any comment on a line changed against `HEAD` (machine directives like `eslint-disable` / `@ts-expect-error`, and `context:`, exempt). |
| `hardcoded-colors`  | native   | Literal hex / `0x` colour values in source (cross-platform; suggests using design tokens).                                                                                                                                                |
| `forbidden-strings` | native   | Disallowed JSON config values, from rules in your verify config.                                                                                                                                                                          |
| `lint`              | external | Lint — auto-fixes locally, checks in CI ([oxlint](https://oxc.rs)).                                                                                                                                                                       |
| `format`            | external | Formatting — writes locally, checks in CI ([oxfmt](https://oxc.rs)).                                                                                                                                                                      |
| `check-types`       | external | TypeScript type check (`tsc --noEmit`); skips when there is no `tsconfig.json`.                                                                                                                                                           |
| `unused-code`       | external | Unused files, exports and dependencies ([knip](https://knip.dev)).                                                                                                                                                                        |
| `circular-deps`     | external | Circular dependencies ([skott](https://github.com/antoine-coulon/skott)).                                                                                                                                                                 |
| `duplicate-code`    | external | Copy-paste detection ([jscpd](https://github.com/kucherenko/jscpd)).                                                                                                                                                                      |

External checks shell out to their tool and **skip gracefully when it is not installed** — `verifyx init` installs the ones you opt into. They run the tool from your local `node_modules/.bin` regardless of how `verifyx` was invoked. `oxlint`/`oxfmt`/`tsc` are resolved if present; the rest are declared as optional `peerDependencies`.

Because checks are named for their function, **on failure** an external check prints the tool it used, the exact command it ran, and a docs link — so you (or an agent) can add the tool's config (e.g. `knip.json`) without guessing. On success it prints nothing (output is buffered and flushed only on failure, to keep runs quiet and cheap). If you override a check with your own `verify:<name>` script, a failure shows that `npm run verify:<name>` was what ran.

### `complexity`

```sh
verifyx complexity --threshold 50 "src/**/*.ts"
```

- `[pattern]` — glob, directory, or file. Defaults to `{src,server,shared}/**/*.ts`.
- `--threshold <n>` — fail when any file's minimum maintainability index is below `n`.
- `--ignore <glob>` — exclude files (repeatable; appended to the default `**/*test.ts*`).

It parses your `.ts`/`.tsx` sources with the TypeScript compiler API and, for every function, computes three metrics — **cyclomatic complexity** (independent paths through the code), **Halstead volume** (a size measure derived from the operators and operands used), and **SLOC** (source lines of code, excluding blanks and comments) — then combines them into a single **maintainability index (MI)**, a 0–100 score where lower means harder to maintain:

```
MI = 171 - 5.2 * ln(HalsteadVolume) - 0.23 * CyclomaticComplexity - 16.2 * ln(SLOC)
```

The result is clamped to 0–100; a function with zero Halstead volume or zero SLOC scores 100. As a rough guide: **> 65** is good, **50–65** is moderate (watch for growth), and **< 50** is hard to maintain. Thresholds are a matter of taste — pick one that fits your codebase and enforce it in CI.

A file's score is the **minimum MI across its functions**. When exactly one file matches, a detailed per-function breakdown (SLOC, cyclomatic complexity, Halstead metrics, and MI) is printed instead of the gate — handy for diagnosing one file at a time. **Fix a failure by splitting the file**, not by gaming the metric (deleting comments, joining lines, shortening names).

### `comments`

```sh
verifyx comments --max-lines 2 --pushback "src/**/*.ts"
```

By default it flags **long comment blocks**. `--block-new-comments` adds a stricter, diff-based gate on top: any comment on a line changed against `HEAD` fails (machine directives like `eslint-disable` / `@ts-expect-error` and `context:`-prefixed comments are exempt).

- `[pattern]` — glob, directory, or file to scan.
- `--max-lines <n>` — fail on comment blocks longer than `n` lines (default 2).
- `--pushback` — add AI back-pressure framing to the failure (keeping the comment "pages a human").
- `--warn` — report the long-block violations without failing.
- `--block-new-comments` — also fail on any comment on a line changed against `HEAD`.
- `--ignore <glob>` — exclude files (repeatable).

Prefix a comment's first line with `context:` to keep genuinely durable context:

```ts
// context: the upstream API returns seconds, not milliseconds — do not "fix" this
const timeoutMs = timeout * 1000
```

## Scaffolding a project

### `verifyx init`

Interactively wire verifications and the agent integration into the current project:

```sh
verifyx init
```

It first asks how `verify` should run — **run all built-in checks** (`verifyx all`, no `verify:*` scripts) or **pick specific checks** to wire up. Then you multi-select **agent targets** (Claude and/or other agents) — and, if you chose to pick, the **checks** — after which it:

- writes the selected `verify:*` scripts to `package.json` (never clobbering existing ones),
- installs the external checks' tools as `--save-dev`,
- writes the **`verify` skill** — the same `SKILL.md` to `.claude/skills/verify/` (Claude) and `.agent-skills/verify/` (cross-vendor), so the integration is identical everywhere,
- appends a one-line pointer to `CLAUDE.md` / `AGENTS.md` (only if not already present; existing content is never rewritten),
- if `unused-code` is selected, adds the other external tools (`oxlint`/`oxfmt`/`skott`/`jscpd`) to knip's `ignoreDependencies` — verifyx runs them at runtime, so knip can't see them and would otherwise report them as unused. Merged into `knip.json` or `package.json#knip` (created if neither exists), adding only what's missing; a code-based `knip.ts`/`knip.js` is left for you to edit.

The skill auto-triggers on "verify"/"run checks", so agents run the checks proactively; the pointer reinforces it for tools that read `CLAUDE.md`/`AGENTS.md` as standing instructions.

Options:

- `--defaults-only` — the non-interactive form of the "run all built-in checks" choice: do **not** write `verify:*` scripts; wire the top-level `verify` script to `verifyx all` so it runs every built-in (still installs opted-in tools and writes the skill + pointer).
- `--yes` — non-interactive; use `--select <name>` (repeatable), `--no-claude`, `--agents`.

### `verifyx upgrade-docs`

Idempotently create/refresh the skill and the `CLAUDE.md`/`AGENTS.md` pointer (created / appended / updated / unchanged; refuses to write through symlinks, never rewrites your instruction files):

```sh
verifyx upgrade-docs              # Claude + other agents
verifyx upgrade-docs --no-agents  # only .claude/ + CLAUDE.md
```

## Configuration

Some checks read per-repo config from `verify.config.json`, or a `verify` key in `package.json`:

```jsonc
{
  "verify": {
    "comments": { "ignore": ["**/*.generated.ts"] },
    "hardcodedColors": { "root": "src", "ignore": ["**/tokens.ts"] },
    "forbiddenStrings": [{ "file": "app.json", "paths": ["env.LOG_LEVEL"], "disallowed": "debug" }],
  },
}
```

## CI/CD

Because it is a pinned dev dependency, CI runs the identical tool:

```yaml
- run: npm ci
- run: npm run verify
```

## Programmatic API

```ts
import { analyzeComplexity, orchestrate, CHECKS } from '@makerx/verify'

const { failing, passed } = analyzeComplexity({
  pattern: 'src/**/*.ts',
  threshold: 50,
})
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
