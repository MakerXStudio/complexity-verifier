export type CheckKind = 'native' | 'external'

/** Fixable checks auto-fix in `fix` mode and only report (failing on issues) in `check` mode. */
export type CheckMode = 'fix' | 'check'

export type CheckResult = {
  name: string
  ok: boolean
  /** True when the check could not run because its underlying tool is not installed. */
  skipped?: boolean
  durationMs?: number
}

/** A single verification. Native checks run in-process; external checks shell out to a tool. */
export type Check = {
  name: string
  description: string
  kind: CheckKind
  /** Whether this check runs as part of the default set when the project has no `verify:*` scripts. */
  inDefaultRun: boolean
  /** Run the check with its default options and print its own report. Resolves to the outcome. */
  runDefault: () => Promise<CheckResult>
  /** How `verify init` wires this check into a consuming project. */
  scaffold: {
    /** The npm script body written as `verify:<name>`. */
    script: string
    /** Extra devDependencies the check needs, installed on opt-in. */
    devDeps?: string[]
  }
}
