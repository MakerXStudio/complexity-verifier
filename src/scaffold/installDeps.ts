import fs from 'node:fs'
import path from 'node:path'

import { runShellCommand } from '../shared/spawn.ts'

/** Signature of the command runner (defaults to `runShellCommand`); injectable so tests don't shell out. */
export type Runner = (command: string, opts: { cwd: string }) => Promise<number>

export type InstallReport = {
  /** Already declared in package.json or present in node_modules — left untouched (no version bump). */
  skipped: string[]
  /** Newly installed successfully. */
  installed: string[]
  /** Attempted but npm exited non-zero (e.g. a peer-dependency conflict) — surfaced for the user to resolve. */
  failed: string[]
}

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type PackageJson = Partial<Record<(typeof DEP_FIELDS)[number], Record<string, string>>>

function declaredDeps(cwd: string): Set<string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8')) as PackageJson
    return new Set(DEP_FIELDS.flatMap((field) => Object.keys(pkg[field] ?? {})))
  } catch {
    return new Set()
  }
}

/**
 * True when the dep is already available — declared in package.json (any dependency field) or resolvable
 * under node_modules. Either way we skip it so `init` never re-installs and bumps an existing version.
 */
function isInstalled(name: string, cwd: string, declared: Set<string>): boolean {
  return declared.has(name) || fs.existsSync(path.join(cwd, 'node_modules', name, 'package.json'))
}

/**
 * Install the given devDeps, skipping any already present. Tries one batch install first (fast path); if that
 * fails — typically a single peer-dependency conflict — falls back to per-package installs so one bad package
 * can't block the rest, and the exact failures are reported instead of aborting `init`.
 */
export async function installDevDeps(devDeps: readonly string[], cwd: string, run: Runner = runShellCommand): Promise<InstallReport> {
  const declared = declaredDeps(cwd)
  const skipped: string[] = []
  const toInstall: string[] = []
  for (const dep of devDeps) (isInstalled(dep, cwd, declared) ? skipped : toInstall).push(dep)

  if (toInstall.length === 0) return { skipped, installed: [], failed: [] }

  // Fast path: one install for everything missing.
  if ((await run(`npm install --save-dev ${toInstall.join(' ')}`, { cwd })) === 0) {
    return { skipped, installed: toInstall, failed: [] }
  }

  // The batch is atomic, so nothing was written — retry each package alone to isolate the culprit(s).
  const installed: string[] = []
  const failed: string[] = []
  for (const dep of toInstall) {
    ;((await run(`npm install --save-dev ${dep}`, { cwd })) === 0 ? installed : failed).push(dep)
  }
  return { skipped, installed, failed }
}
