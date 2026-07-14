# Design: `--max-warnings` for `unused-code` and `duplicate-code`

**Date:** 2026-07-14
**Status:** Approved

## Summary

Add a `--max-warnings <n>` flag to the `unused-code` (knip) and `duplicate-code`
(jscpd) checks. It is an ESLint-style tolerance gate: the check passes while the
number of findings stays at or below `n`, and fails when it exceeds `n`. This lets
a project adopt either check on a codebase that already has debt — set the budget
at (or just below) the current count and ratchet it down over time, without letting
new findings slip in.

## Motivation

Today both checks are all-or-nothing: knip fails if there is _any_ unused
file/export/dependency, and jscpd fails on _any_ duplication. On an existing
codebase that means the check is red from day one and stays red until every finding
is fixed, so teams tend not to turn it on at all. A tolerance budget makes gradual
adoption possible.

Neither underlying tool has a native count-based gate:

- **knip** exits non-zero whenever there is any finding; it has no "max issues" flag.
- **jscpd** only offers `--threshold <percent>` (a duplication _percentage_), not a
  count of clones.

So `verifyx` itself must count findings from each tool's machine-readable output and
decide pass/fail. That is the core of this design.

## Behavior

- New flag `--max-warnings <n>` on `verifyx unused-code` and `verifyx duplicate-code`.
  `n` is a non-negative integer.
- **Without the flag:** unchanged — the current exit-code path, zero tolerance.
- **With the flag:** `verifyx` runs the tool in a machine-readable "count" mode,
  tallies findings, and:
  - `count <= n` → **pass**, silent (per the project's quiet-on-success rule).
  - `count > n` → **fail**, printing a one-line count summary, then the tool's normal
    findings report, then the existing external-failure hint.
- **Count unit:**
  - `unused-code` (knip): total unused _items_ — every unused file, export, exported
    type, and dependency, summed into a single number.
  - `duplicate-code` (jscpd): the number of detected duplicate _clones_.

## How it flows through `verifyx`

`--max-warnings` is a subcommand flag, so it rides the existing curated-gate pattern.
A consumer wires a budget into their `package.json`:

```jsonc
{
  "scripts": {
    "verify:unused-code": "verifyx unused-code --max-warnings 5",
    "verify:duplicate-code": "verifyx duplicate-code --max-warnings 10",
  },
}
```

- **Bare `verifyx`** (the curated gate) runs these `verify:*` scripts verbatim, so the
  budget applies.
- **`verifyx all`** runs each built-in via `runDefault()` with _no_ arguments, so a
  built-in with no override runs at its **default: zero tolerance** (today's behavior).
  A `verify:<name>` script that matches a built-in **overrides** it under `verifyx all`,
  so the same one-line script above is also how you apply a budget in "run everything"
  mode. `verifyx all` never adds flags on its own.
- **Passthrough is preserved:** `verifyx unused-code --max-warnings 5 -- --production`
  forwards `--production` to knip, and `--max-warnings` is consumed by `verifyx`.

## Implementation

The design reuses `defineExternalCheck` rather than adding bespoke check types.

### `ExternalCheckSpec` gains an optional counting capability

Only `unused-code` and `duplicate-code` set it; every other external check is untouched
and rejects `--max-warnings` (the flag is not registered for them).

```ts
export type MaxWarningsSupport = {
  /** Run the tool in machine-readable mode and return the total finding count. */
  count: (ctx: { extraArgs: string[]; env: Record<string, string> }) => Promise<number>
}
```

`ExternalCheckSpec` gets `maxWarnings?: MaxWarningsSupport`.

### `RunDefaultOptions` gains `maxWarnings?: number`

```ts
export type RunDefaultOptions = {
  extraArgs?: string[]
  /** When set, the check counts findings and passes iff count <= maxWarnings (external checks that support it). */
  maxWarnings?: number
}
```

### `runDefault` branch

`defineExternalCheck`'s `runDefault` takes the counting path **only** when
`maxWarnings` is provided _and_ the spec has a `maxWarnings` capability; otherwise it
runs exactly as today. The bin-present and `canRun` guards run first, unchanged (so a
missing tool still skips gracefully before any counting).

Counting path:

1. `count = await spec.maxWarnings.count({ extraArgs, env: envWithLocalBin() })`.
2. `count <= maxWarnings` → return `{ ok: true }`, print nothing.
3. `count > maxWarnings` → print a one-line summary (e.g.
   `duplicate-code: 12 clones found, exceeds --max-warnings 10`), then re-run the
   tool's normal `checkCommand` (buffered) so the familiar findings report is shown,
   then the existing `externalFailureHint`. Return `{ ok: false }`.

In count mode the tool's own exit code is **ignored** for the verdict (knip exits
non-zero on any finding, even within budget); the verdict is purely the parsed count.

### New spawn helper

`runCommand` currently returns only the exit code and emits output to the buffer. Add a
sibling that returns captured stdout for parsing, leaving `runCommand` untouched:

```ts
export function captureCommand(command: string, opts?: RunCommandOptions): Promise<{ code: number; stdout: string }>
```

### Per-tool count functions

Extracted as exported **pure parsers** so they are unit-testable without the real tools;
the `count` functions wire the parser to a real invocation.

- **knip** — `knip --reporter json --no-progress [extraArgs]`, capture stdout, then
  `countKnipFindings(json)`: `files.length` plus the summed lengths of every issue array
  across `issues[]` (dependencies, devDependencies, optionalPeerDependencies, unlisted,
  binaries, unresolved, exports, nsExports, types, nsTypes, enumMembers, duplicates,
  and any other array-valued issue fields). The exact knip JSON shape is confirmed
  against the installed knip during implementation and pinned with a fixture test.
- **jscpd** — jscpd has no stdout JSON reporter, so run it with the JSON reporter into a
  fresh OS temp dir (`fs.mkdtemp` under `os.tmpdir()`), read `jscpd-report.json`, then
  `countJscpdClones(json)`: `statistics.total.clones` (falling back to
  `duplicates.length`). The temp dir is removed afterward (including on error). jscpd's
  console reporters are suppressed for the count run.

### `registerChecks`

`unused-code` and `duplicate-code` are registered explicitly (out of the generic
external loop) so they can declare `--max-warnings <n>` alongside the existing
`[toolArgs...]` passthrough:

```ts
program
  .command('unused-code')
  .description(...)
  .option('--max-warnings <n>', 'tolerate up to n findings before failing', Number)
  .argument('[toolArgs...]', 'extra arguments passed through to the underlying tool (after `--`)')
  .action(async (toolArgs, opts) => {
    finish((await getCheck('unused-code')!.runDefault({ extraArgs: toolArgs, maxWarnings: opts.maxWarnings })).ok)
  })
```

All other external checks keep the generic registration loop.

## Errors and edge cases

- **Invalid `n`** (negative, non-integer, or `NaN` from a non-numeric value) → a clear
  error message and non-zero exit, before running any tool.
- **`--max-warnings 0`** is valid and equivalent to today's zero-tolerance behavior
  (routed through the count path).
- **Count command crashes or emits unparseable output** → fail loudly (never silently
  pass): surface the raw output and the failure hint. A parse failure is a check failure.
- **Tool not installed / `canRun` false** → skip, exactly as today (guards run before
  counting).

## Docs and programmatic API

- **README:** document `--max-warnings` under the `unused-code` and `duplicate-code`
  sections — the count semantics per tool, the `verify:<name>` override needed for
  `verifyx all`, and that the default is zero tolerance. Note it in the built-in-checks
  overview where relevant.
- **Programmatic:** `getCheck('unused-code')?.runDefault({ maxWarnings: 5 })` works via
  the existing registry entry point; no new export beyond the count parsers.

## Testing

Following the existing `external.test.ts` pure-function style:

- `countKnipFindings` against a JSON fixture with mixed issue types → expected total.
- `countJscpdClones` against a JSON fixture → expected clone count.
- The decision logic: `count <= n` → ok, `count > n` → fail (spec with a stubbed
  `count`), including the `n = 0` boundary.
- `--max-warnings` argument validation (rejects negative / non-integer).

The `count` functions themselves (which spawn the real tools) are covered indirectly;
the parsers hold the logic that needs pinning.

## Out of scope

- Applying a budget automatically under `verifyx all` without a `verify:<name>` override.
- Persisting the budget in `verify.config.json` (external checks are configured through
  their own tool config; the flag lives on the script, consistent with the existing model).
- Per-category budgets for knip (a single total count is the agreed unit).
- Adding `--max-warnings` to other external checks.

## Update (post-implementation review)

A Codex review found that knip **does** have a native budget flag,
[`--max-issues`](https://knip.dev/reference/cli#--max-issues) — this design's premise
that "knip has no max-issues flag" was wrong. The implementation therefore diverged:

- **`unused-code` uses a `flag` strategy** — it appends knip's own `--max-issues <n>` and
  takes the verdict from knip's exit code, rather than parsing knip JSON (`countKnipFindings`
  is gone). This is more correct: knip counts error-level findings honouring rule severity,
  and enforces config-hint / operational (exit 2) failures independently of the budget, so a
  tolerance no longer suppresses unrelated errors.
- **`duplicate-code` keeps the `count` strategy** (jscpd has no native clone-count gate).
  `countJscpdClones` now throws on an unrecognised report shape instead of returning zero.

So `MaxWarningsSupport` is a two-variant union (`flag` | `count`), not the single `count`
shape sketched above. The counting-path runner is `runCountedBudget`.
