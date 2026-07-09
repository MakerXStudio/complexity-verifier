import type { Command } from 'commander'
import { minimatch } from 'minimatch'

import { analyzeAddedComments, formatHookFeedback, hasFindings, type HookOptions } from '../hook/analyze.ts'
import { parsePostToolUsePayload } from '../hook/payload.ts'
import { loadVerifyConfig } from '../shared/config.ts'

const DEFAULT_MAX_LINES = 2
const DEFAULT_DENSITY = 0.3
const DEFAULT_MIN_ADDED_LINES = 10

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

function resolveOptions(): { options: HookOptions; ignore: string[] } {
  const cfg = loadVerifyConfig().comments ?? {}
  const density = cfg.density === false ? 0 : (cfg.density ?? DEFAULT_DENSITY)
  return {
    options: {
      maxLines: DEFAULT_MAX_LINES,
      narration: cfg.narration ?? true,
      density,
      minAddedLines: cfg.minAddedLines ?? DEFAULT_MIN_ADDED_LINES,
    },
    ignore: cfg.ignore ?? [],
  }
}

/**
 * `verifyx comments-hook` — a Claude Code PostToolUse hook. Reads the tool payload on stdin, scans the text the
 * Edit/Write introduced, and on low-value comments writes feedback to stderr and exits 2 so the agent revises
 * in-loop. Stays silent (exit 0) when the edit is clean or the payload is not a scannable file edit.
 */
export function registerCommentsHook(program: Command): void {
  program
    .command('comments-hook', { hidden: true })
    .description('Claude Code PostToolUse hook: flag low-value comments an edit introduced (reads hook JSON on stdin)')
    .action(async () => {
      const target = parsePostToolUsePayload(await readStdin())
      if (!target) return
      const { options, ignore } = resolveOptions()
      if (ignore.some((glob) => minimatch(target.file, glob))) return

      const findings = analyzeAddedComments(target, options)
      if (!hasFindings(findings)) return

      process.stderr.write(`${formatHookFeedback(findings)}\n`)
      process.exitCode = 2
    })
}
