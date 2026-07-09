import type { CheckMode } from '../checks/types.ts'

/**
 * Resolve the run mode. The AI/human running `verify` locally gets `fix` (auto-fix, no token churn);
 * CI gets `check` (fail on issues, never rewrite). An explicit `--check`/`--fix` sets `VERIFY_MODE`,
 * which wins; otherwise a truthy `CI` env means check.
 */
export function resolveMode(): CheckMode {
  const explicit = process.env.VERIFY_MODE
  if (explicit === 'check' || explicit === 'fix') return explicit
  if (process.env.CI) return 'check'
  return 'fix'
}

/** Apply a `--check`/`--fix` override so it propagates to in-process checks and spawned child scripts. */
export function configureMode(opts?: { check?: boolean; fix?: boolean }): void {
  if (opts?.check) process.env.VERIFY_MODE = 'check'
  else if (opts?.fix) process.env.VERIFY_MODE = 'fix'
}
