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

Requires Node.js >= 24. Invoke it via an npm script or `npx verify` — not a global binary on `PATH`.

The quickest way to wire it into a project:

```sh
npx verify init
```

## How `verify` decides what to run

Running `verify` with no subcommand follows a convention:

- **No `verify:*` scripts in `package.json`** → it runs the **built-in default checks** in their default modes. Each check degrades gracefully — it passes or skips when it does not apply (no files, no diff, tool not installed, no rules configured).
- **`verify:*` scripts present** → it runs **those** in parallel. Output from each is buffered and shown **only if it fails**, keeping passing runs quiet (and quieter still under Claude Code). Add `--verbose` to stream everything.

You take control by adding `verify:*` scripts. Each can call a built-in or run your own command:

```jsonc
{
  "scripts": {
    "verify": "verify",
    "verify:complexity": "verify complexity --threshold 50 \"src/**/*.ts\"",
    "verify:knip": "knip --no-progress --treat-config-hints-as-errors",
    "verify:types": "tsc --noEmit",
  },
}
```

Run a single built-in directly: `verify complexity`, `verify knip`, … and `verify list` shows them all.

Flags on the bare `verify` command:

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
| `knip`              | external | Unused files, exports and dependencies ([knip](https://knip.dev)).                                                                          |
| `circular-deps`     | external | Circular dependencies ([skott](https://github.com/antoine-coulon/skott)).                                                                   |
| `duplicate-code`    | external | Copy-paste detection ([jscpd](https://github.com/kucherenko/jscpd)).                                                                        |
| `lint`              | external | Lint + autofix ([oxlint](https://oxc.rs)).                                                                                                  |

External checks shell out to their tool and **skip gracefully when it is not installed** — `verify init` installs the ones you opt into. They are declared as optional `peerDependencies`.

### `complexity`

```sh
verify complexity --threshold 50 "src/**/*.ts"
```

- `[pattern]` — glob, directory, or file. Defaults to `{src,server,shared}/**/*.ts`.
- `--threshold <n>` — fail when any file's minimum maintainability index is below `n`.
- `--ignore <glob>` — exclude files (repeatable; appended to the default `**/*test.ts*`).

A file's score is the **minimum MI across its functions**. When exactly one file matches, a detailed per-function breakdown is printed instead of the gate — handy for diagnosing one file at a time. **Fix a failure by splitting the file**, not by gaming the metric (deleting comments, joining lines, shortening names).

### `comment-block`

```sh
verify comment-block --max-lines 2 --pushback "src/**/*.ts"
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

### `verify init`

Interactively wire verifications and agent files into the current project:

```sh
verify init
```

It lets you multi-select **checks** and **agent targets** (Claude `.claude/`, and/or cross-vendor `.agent-skills/`), then:

- writes the selected `verify:*` scripts to `package.json` (never clobbering existing ones),
- installs the external checks' tools as `--save-dev`,
- emits the agent command/skill files.

Options:

- `--defaults-only` — do **not** write `verify:*` scripts; rely on `verify`'s built-in defaults (still installs opted-in tools and writes agent files).
- `--yes` — non-interactive; use `--check <name>` (repeatable), `--no-claude`, `--agents`.

### `verify upgrade-docs`

Idempotently create/refresh the managed agent files (created / updated / unchanged; refuses to write through symlinks):

```sh
verify upgrade-docs            # both targets
verify upgrade-docs --no-agents  # only .claude/
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

`filters` scopes a `verify:*` script to a diff glob: it is skipped unless a changed file matches (bypass with `verify --all`).

## CI/CD

Because it is a pinned dev dependency, CI runs the identical tool:

```yaml
- run: npm ci
- run: npx verify --measure
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
