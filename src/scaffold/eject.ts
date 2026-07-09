import path from 'node:path'

import { CHECKS, getCheck } from '../checks/registry.ts'
import { setScripts } from './packageScripts.ts'

export type EjectResult = {
  /** The `verify:*` scripts written, keyed by script name. */
  scripts: Record<string, string>
}

/** The verify:* scripts an eject of `check` would write: its raw check command, plus a `:fix` variant if fixable. */
export function ejectScripts(name: string): Record<string, string> {
  const check = getCheck(name)
  if (!check) {
    const known = CHECKS.filter((c) => c.eject)
      .map((c) => c.name)
      .join(', ')
    throw new Error(`Unknown check "${name}". Ejectable checks: ${known}.`)
  }
  if (!check.eject) {
    throw new Error(`"${name}" is a ${check.kind} check with no underlying command to eject; only external checks can be ejected.`)
  }
  const scripts: Record<string, string> = { [`verify:${name}`]: check.eject.check }
  if (check.eject.fix) scripts[`verify:${name}:fix`] = check.eject.fix
  return scripts
}

/** Inline an external check's raw tool command into the consumer's `verify:*` scripts, overwriting the wrapper. */
export function applyEject(cwd: string, name: string): EjectResult {
  const scripts = ejectScripts(name)
  setScripts(path.join(cwd, 'package.json'), scripts)
  return { scripts }
}
