import fs from 'node:fs'

import { minimatch } from 'minimatch'

const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.yml', '.yaml']

// context: machine directives steer tooling, not humans, so a changed line carrying one is never a "comment"
// worth removing; `context:` is this project's durable-context escape hatch and is likewise exempt.
const MACHINE_DIRECTIVES = [
  'oxlint-disable',
  'oxlint-enable',
  '@ts-expect-error',
  '@ts-ignore',
  '@ts-nocheck',
  'eslint-disable',
  'eslint-enable',
  'prettier-ignore',
  'istanbul ignore',
  'v8 ignore',
  'c8 ignore',
  '@vitest-environment',
]

export type NewComment = { file: string; line: number; text: string }

export function isCommentExempt(text: string): boolean {
  const lower = text.toLowerCase()
  if (MACHINE_DIRECTIVES.some((d) => lower.includes(d))) return true
  const stripped = text.replace(/^\s*(?:\/\/+|\/\*+|\*|#)\s*/, '')
  return stripped.toLowerCase().startsWith('context:')
}

export function isScannedExtension(file: string): boolean {
  return SCANNED_EXTENSIONS.some((ext) => file.endsWith(ext))
}

/** JSDoc (`/** … *\/`) is an always-allowed escape hatch, so the diff-scoped gates skip it like `context:`. */
function isJsDoc(text: string): boolean {
  return text.trimStart().startsWith('/**')
}

/** Exempt from the diff-scoped gates: machine directives, `context:` blocks, and JSDoc. */
export function isDiffExempt(text: string): boolean {
  return isCommentExempt(text) || isJsDoc(text)
}

export function shouldScan(file: string, ignoreGlobs: readonly string[]): boolean {
  if (!isScannedExtension(file)) return false
  if (ignoreGlobs.some((glob) => minimatch(file, glob))) return false
  return fs.existsSync(file)
}

export function toSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Physical lines a scanned comment occupies (block comments carry embedded newlines in their text). */
export function commentSpan(text: string): number {
  return text.split('\n').length
}

// context: a line-level comment test for *removed* diff lines — we can't AST a line that no longer exists on
// disk, so the density net-increase guard falls back to prefix matching (mirrors the checker's is_comment_line).
export function looksLikeCommentLine(line: string): boolean {
  const s = line.trimStart()
  if (s.startsWith('#!')) return false
  return s.startsWith('//') || s.startsWith('/*') || s.startsWith('*') || s.startsWith('#') || s.startsWith('--')
}
