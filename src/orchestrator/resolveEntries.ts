import fs from 'node:fs'
import path from 'node:path'

import type { CheckMode } from '../checks/types.ts'

export type VerifyEntry = {
  name: string
  command: string
  cwd: string
}

const VERIFY_PREFIX = 'verify:'
const FIX_SUFFIX = ':fix'

/** The check a `verify:*` script targets, ignoring a trailing `:fix`. `verify:lint` and `verify:lint:fix` → `lint`. */
export function entryCheckName(entryName: string): string {
  const withoutPrefix = entryName.startsWith(VERIFY_PREFIX) ? entryName.slice(VERIFY_PREFIX.length) : entryName
  return withoutPrefix.endsWith(FIX_SUFFIX) ? withoutPrefix.slice(0, -FIX_SUFFIX.length) : withoutPrefix
}

/** Walk up from `startDir` to the nearest package.json. */
function findPackageJson(startDir: string): string | null {
  let dir = path.resolve(startDir)
  for (;;) {
    const candidate = path.join(dir, 'package.json')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

type PackageJson = { scripts?: Record<string, string> }

/** Collect the project's `verify:*` npm scripts as parallelisable entries, nearest package.json wins. */
export function resolveEntries(cwd: string = process.cwd()): VerifyEntry[] {
  const pkgPath = findPackageJson(cwd)
  if (!pkgPath) return []
  let pkg: PackageJson
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson
  } catch {
    return []
  }
  const scripts = pkg.scripts ?? {}
  const dir = path.dirname(pkgPath)
  return Object.keys(scripts)
    .filter((name) => name.startsWith(VERIFY_PREFIX))
    .map((name) => ({ name, command: `npm run ${name}`, cwd: dir }))
}

/**
 * Collapse `verify:<name>` / `verify:<name>:fix` pairs to one entry per check for the run mode: fix mode
 * prefers the `:fix` variant (falling back to the base), check mode uses the base only. This is what bare
 * `verifyx` runs.
 */
export function selectEntries(entries: readonly VerifyEntry[], mode: CheckMode): VerifyEntry[] {
  const byCheck = new Map<string, { base?: VerifyEntry; fix?: VerifyEntry }>()
  for (const entry of entries) {
    const key = entryCheckName(entry.name)
    const group = byCheck.get(key) ?? {}
    if (entry.name.endsWith(FIX_SUFFIX)) group.fix = entry
    else group.base = entry
    byCheck.set(key, group)
  }
  const selected: VerifyEntry[] = []
  for (const { base, fix } of byCheck.values()) {
    const chosen = mode === 'fix' ? (fix ?? base) : base
    if (chosen) selected.push(chosen)
  }
  return selected
}

/** The override script for a built-in `<checkName>` under `verifyx all`: the `:fix` variant in fix mode, else the base. */
export function resolveOverride(entries: readonly VerifyEntry[], checkName: string, mode: CheckMode): VerifyEntry | undefined {
  const fix = entries.find((entry) => entry.name === `${VERIFY_PREFIX}${checkName}${FIX_SUFFIX}`)
  const base = entries.find((entry) => entry.name === `${VERIFY_PREFIX}${checkName}`)
  return mode === 'fix' ? (fix ?? base) : base
}
