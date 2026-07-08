import fs from 'node:fs'

import { minimatch } from 'minimatch'

import { color } from '../shared/color.ts'
import { scanFileComments } from '../shared/comment-scan.ts'
import { loadVerifyConfig } from '../shared/config.ts'
import { parseDiffAddedLines } from '../shared/diff.ts'
import { gitDiffHead } from '../shared/git.ts'
import type { CheckResult } from './types.ts'

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

function isCommentExempt(text: string): boolean {
  const lower = text.toLowerCase()
  if (MACHINE_DIRECTIVES.some((d) => lower.includes(d))) return true
  const stripped = text.replace(/^\s*(?:\/\/+|\/\*+|\*|#)\s*/, '')
  return stripped.toLowerCase().startsWith('context:')
}

function shouldScan(file: string, ignoreGlobs: readonly string[]): boolean {
  if (!SCANNED_EXTENSIONS.some((ext) => file.endsWith(ext))) return false
  if (ignoreGlobs.some((glob) => minimatch(file, glob))) return false
  return fs.existsSync(file)
}

function toSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export type BlockCommentsOptions = { ignore?: readonly string[] }

/** Fail on any comment sitting on a line changed against HEAD. Machine directives and `context:` are exempt. */
export function runBlockComments(opts: BlockCommentsOptions = {}): CheckResult {
  const ignoreGlobs = opts.ignore ?? loadVerifyConfig().blockComments?.ignore ?? []
  const added = parseDiffAddedLines(gitDiffHead())

  const findings: Array<{ file: string; line: number; text: string }> = []
  for (const [file, lines] of added) {
    if (!shouldScan(file, ignoreGlobs)) continue
    for (const comment of scanFileComments(file)) {
      if (!lines.has(comment.line)) continue
      if (isCommentExempt(comment.text)) continue
      findings.push({ file, line: comment.line, text: toSingleLine(comment.text) })
    }
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  if (findings.length === 0) {
    console.log(color.green('No comments on changed lines.'))
    return { name: 'block-comments', ok: true }
  }

  console.error(color.red('\nComments on changed lines:\n'))
  for (const { file, line, text } of findings) console.error(`  ${file}:${line} → ${text}`)
  console.error(color.red(`\nTotal: ${findings.length} comment(s)`))
  console.error(
    '\nEvery comment on a changed line fails this gate, whether you added or edited it. Remove them and let the code document itself.',
  )
  return { name: 'block-comments', ok: false }
}
