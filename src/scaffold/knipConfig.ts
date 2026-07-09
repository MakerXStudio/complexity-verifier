import fs from 'node:fs'
import path from 'node:path'

import type { ManagedFileResult } from './writeManaged.ts'

// Code-based knip configs are the user's to manage — we won't rewrite JS/TS.
const CODE_CONFIGS = ['knip.ts', 'knip.js', 'knip.config.ts', 'knip.config.js', 'knip.jsonc']
const SCHEMA = 'https://unpkg.com/knip/schema.json'

type KnipConfig = { ignoreDependencies?: string[] } & Record<string, unknown>

/** Append any missing `deps` to `existing`, preserving order; report whether anything changed. */
function addMissing(existing: string[] | undefined, deps: readonly string[]): { list: string[]; changed: boolean } {
  const list = [...(existing ?? [])]
  let changed = false
  for (const dep of deps) {
    if (!list.includes(dep)) {
      list.push(dep)
      changed = true
    }
  }
  return { list, changed }
}

function mergeInto(config: KnipConfig, deps: readonly string[]): boolean {
  const { list, changed } = addMissing(config.ignoreDependencies, deps)
  if (changed) config.ignoreDependencies = list
  return changed
}

/**
 * Ensure the project's knip config ignores `deps` — the tools verifyx invokes at runtime (via node_modules/.bin),
 * which knip can't see and would otherwise flag as unused. Adds only what's missing (idempotent), never removes
 * or rewrites unrelated content. Merges into an existing `knip.json` or `package.json#knip`, creates a minimal
 * `knip.json` if there's no config, and leaves code-based configs (knip.ts/js) untouched.
 */
export function ensureKnipIgnores(cwd: string, deps: readonly string[], results: ManagedFileResult[]): void {
  if (deps.length === 0) return
  if (CODE_CONFIGS.some((file) => fs.existsSync(path.join(cwd, file)))) return

  const jsonPath = path.join(cwd, 'knip.json')
  if (fs.existsSync(jsonPath)) {
    const config = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as KnipConfig
    const changed = mergeInto(config, deps)
    if (changed) fs.writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`)
    results.push({ path: jsonPath, action: changed ? 'updated' : 'unchanged' })
    return
  }

  const pkgPath = path.join(cwd, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { knip?: KnipConfig } & Record<string, unknown>
  if (pkg.knip && typeof pkg.knip === 'object') {
    const changed = mergeInto(pkg.knip, deps)
    if (changed) fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    results.push({ path: pkgPath, action: changed ? 'updated' : 'unchanged' })
    return
  }

  fs.writeFileSync(jsonPath, `${JSON.stringify({ $schema: SCHEMA, ignoreDependencies: [...deps] }, null, 2)}\n`)
  results.push({ path: jsonPath, action: 'created' })
}
