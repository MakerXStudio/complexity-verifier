import fs from 'node:fs'
import path from 'node:path'

/** A rule for the forbidden-strings check: JSON values at `paths` in `file` must not match `disallowed`. */
export type ForbiddenStringsRule = {
  file: string
  paths: string[]
  disallowed: string
}

export type VerifyConfig = {
  comments?: {
    ignore?: string[]
    /** Which comments the gates judge: `diff` (changed lines only) or `all` (whole codebase). Default `diff`. */
    scope?: 'diff' | 'all'
    /** Fail every comment in scope, not just heuristic hits. Default false. */
    blockAll?: boolean
    /** Flag session-narration comments. Default true. */
    narration?: boolean
    /** Comment-density ratio (0–1) that fails a file; `false`/`0` disables. Default 0.3. */
    density?: number | false
    /** Minimum added/scanned lines before density applies. Default 10. */
    minAddedLines?: number
    /** Honour the `context:` override (those comments stay exempt). Default true; set false for a stricter gate / cleanup. */
    contextOverride?: boolean
  }
  hardcodedColors?: { ignore?: string[]; root?: string }
  forbiddenStrings?: ForbiddenStringsRule[]
}

const CONFIG_FILE = 'verify.config.json'

function readJsonIfExists(file: string): unknown {
  if (!fs.existsSync(file)) return undefined
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return undefined
  }
}

/** Load per-repo check configuration from `verify.config.json`, falling back to a `verify` key in package.json. */
export function loadVerifyConfig(cwd: string = process.cwd()): VerifyConfig {
  const fromFile = readJsonIfExists(path.join(cwd, CONFIG_FILE))
  if (fromFile && typeof fromFile === 'object') return fromFile as VerifyConfig

  const pkg = readJsonIfExists(path.join(cwd, 'package.json'))
  if (pkg && typeof pkg === 'object' && 'verify' in pkg) {
    const verify = (pkg as { verify?: unknown }).verify
    if (verify && typeof verify === 'object') return verify as VerifyConfig
  }
  return {}
}
