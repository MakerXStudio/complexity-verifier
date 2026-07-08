import fs from 'node:fs'
import path from 'node:path'

export type VerifyEntry = {
  name: string
  command: string
  cwd: string
  filter?: string
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

type PackageJson = {
  scripts?: Record<string, string>
  verify?: { filters?: Record<string, string> }
}

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
  const filters = pkg.verify?.filters ?? {}
  const dir = path.dirname(pkgPath)
  return Object.keys(scripts)
    .filter((name) => name.startsWith('verify:'))
    .map((name) => ({ name, command: `npm run ${name}`, cwd: dir, filter: filters[name] }))
}
