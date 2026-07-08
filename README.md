# @makerx/complexity-verifier

A maintainability-index checker for TypeScript. It parses your `.ts`/`.tsx` sources with the TypeScript compiler API and, for every function, computes:

- **Cyclomatic complexity** — the number of independent paths through the code.
- **Halstead volume** — a size measure derived from the operators and operands used.
- **SLOC** — source lines of code (blank lines and comments excluded).
- **Maintainability index (MI)** — a 0–100 score combining the three above.

A file's score is the **minimum MI across its functions**, and the check **fails any file below the `--threshold`**. Lower MI means harder to maintain.

## Install

```sh
npm i -D @makerx/complexity-verifier
```

Requires Node.js >= 24.

## CLI usage

```sh
# Fail if any file scores below a maintainability index of 50
npx complexity-verifier --threshold 50 "src/**/*.ts"
```

Arguments:

- **`<pattern>`** (positional) — a glob, a directory, or a single file. Defaults to `{src,server,shared}/**/*.ts`. A bare filename with no glob or slash is treated as a recursive search (`**/<name>`).
- **`--threshold <n>`** — fail (exit code `1`) when any file's minimum MI is below `n`. Without a threshold the tool just reports.
- **`--ignore <glob>`** — exclude matching files. Repeatable. Appended to the default ignore of `**/*test.ts*`.

When exactly one file is matched, the tool prints a detailed per-function breakdown (SLOC, cyclomatic complexity, Halstead metrics, and MI) instead of the pass/fail report — handy when diagnosing a single file.

Example in `package.json`:

```json
{
  "scripts": {
    "verify:complexity": "complexity-verifier --threshold 50 \"src/**/*.ts\""
  }
}
```

## Fixing failures — one file at a time

When the check fails, **diagnose and fix one file at a time** — do not investigate or fix multiple files in parallel. Run the CLI against a single file to see all of its metrics:

```sh
npx complexity-verifier src/some/hard-to-maintain-file.ts
```

For larger files, start by extracting responsibilities into smaller files; then reduce branching and simplify expressions in the worst-scoring functions.

## Programmatic API

The package is also usable as a library:

```ts
import { analyzeComplexity } from '@makerx/complexity-verifier'

const { results, failing, passed } = analyzeComplexity({
  pattern: 'src/**/*.ts',
  ignore: ['**/*.generated.ts'],
  threshold: 50,
})

if (!passed) {
  for (const { file, min, avg } of failing) {
    console.error(`${file}: min MI ${min.toFixed(1)} (avg ${avg.toFixed(1)})`)
  }
}
```

Lower-level metric helpers are also exported: `calculateCyclomaticComplexity`, `calculateHalstead`, `calculateMaintainabilityIndex`, `countSloc`, `scoreFiles`, `findSourceFiles`, and `forEachFunction`.

## The maintainability index formula

```
MI = 171 - 5.2 * ln(HalsteadVolume) - 0.23 * CyclomaticComplexity - 16.2 * ln(SLOC)
```

The result is clamped to the range 0–100. A function with zero Halstead volume or zero SLOC scores 100.

Rough interpretation:

- **> 65** — good maintainability.
- **50–65** — moderate; watch for growth.
- **< 50** — hard to maintain; consider refactoring.

Thresholds are a matter of taste — pick one that fits your codebase and enforce it in CI.

## Publishing

Releases are automated with [release-please](https://github.com/googleapis/release-please) and published to npm via **npm trusted publishing (OIDC)**. A trusted publisher for this package must be configured on npmjs.com (linking the GitHub repository and the release workflow) before the first automated publish will succeed.

## Attribution

The metric algorithms are ported from [staff0rd/assist](https://github.com/staff0rd/assist/tree/75a75899d7578769a433fb8058c96dd29410c254/src/commands/complexity).

## License

MIT
