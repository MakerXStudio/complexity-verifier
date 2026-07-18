import { describe, expect, it, vi } from 'vitest'

import { runCaptured } from '../shared/output.ts'
import { buildArgv, defineExternalCheck, externalFailureHint, formatCommand, runCountedBudget, selectCommand } from './external.ts'

const fixable = { checkCommand: 'oxfmt --check .', fixCommand: 'oxfmt .' }
const notFixable = { checkCommand: 'tsc --noEmit' }

describe('selectCommand', () => {
  it('uses the fix command in fix mode when the check is fixable', () => {
    expect(selectCommand(fixable, 'fix')).toBe('oxfmt .')
  })

  it('uses the check command in check mode', () => {
    expect(selectCommand(fixable, 'check')).toBe('oxfmt --check .')
  })

  it('always uses the check command when the check has no fix command', () => {
    expect(selectCommand(notFixable, 'fix')).toBe('tsc --noEmit')
    expect(selectCommand(notFixable, 'check')).toBe('tsc --noEmit')
  })
})

describe('externalFailureHint', () => {
  it('names the tool, the exact command that ran, and the docs link', () => {
    const hint = externalFailureHint({ name: 'unused-code', bin: 'knip', docs: 'https://knip.dev' }, 'knip --no-progress')
    expect(hint).toContain('unused-code')
    expect(hint).toContain('knip')
    expect(hint).toContain('knip --no-progress')
    expect(hint).toContain('https://knip.dev')
  })

  it('still names the tool and command when no docs link is set', () => {
    const hint = externalFailureHint({ name: 'circular-deps', bin: 'skott' }, 'skott src')
    expect(hint).toContain('skott')
    expect(hint).toContain('skott src')
    expect(hint).not.toContain('undefined')
  })
})

describe('buildArgv', () => {
  it('tokenises the base command, keeping a quoted default as a single literal entry', () => {
    expect(buildArgv('jscpd --format typescript,tsx --ignore "**/*.test.*" -r consoleFull src')).toEqual([
      'jscpd',
      '--format',
      'typescript,tsx',
      '--ignore',
      '**/*.test.*',
      '-r',
      'consoleFull',
      'src',
    ])
  })

  it('appends each passthrough arg as its own literal entry (globs and spaces are never split or expanded)', () => {
    expect(buildArgv('jscpd --ignore "**/*.test.*" src', ['--ignore', '**/generated/**', 'has space'])).toEqual([
      'jscpd',
      '--ignore',
      '**/*.test.*',
      'src',
      '--ignore',
      '**/generated/**',
      'has space',
    ])
  })

  it('preserves shell metacharacters in passthrough args verbatim', () => {
    expect(buildArgv('tool', ['$HOME', ';whoami', 'a|b', '`id`'])).toEqual(['tool', '$HOME', ';whoami', 'a|b', '`id`'])
  })

  it('returns just the tokenised command when there are no extra args', () => {
    expect(buildArgv('oxlint .', [])).toEqual(['oxlint', '.'])
    expect(buildArgv('oxlint .')).toEqual(['oxlint', '.'])
  })
})

describe('formatCommand', () => {
  it('renders a copy-pasteable, quoted command line for diagnostics without changing what runs', () => {
    expect(formatCommand(['jscpd', '--ignore', '**/generated/**', 'has space'])).toBe('jscpd --ignore "**/generated/**" "has space"')
  })
})

describe('defineExternalCheck', () => {
  it('exposes raw commands for eject, including the fix variant when fixable', () => {
    const lint = defineExternalCheck({
      name: 'lint',
      description: '',
      bin: 'oxlint',
      checkCommand: 'oxlint .',
      fixCommand: 'oxlint --fix .',
      devDeps: [],
    })
    expect(lint.eject).toEqual({ check: 'oxlint .', fix: 'oxlint --fix .' })
  })

  it('scaffolds default trailing args after `--` so a consumer can see and tweak them', () => {
    const circular = defineExternalCheck({
      name: 'circular-deps',
      description: '',
      bin: 'skott',
      checkCommand: 'skott',
      devDeps: [],
      scaffoldArgs: 'src/*.ts',
    })
    expect(circular.scaffold.script).toBe('verifyx circular-deps -- src/*.ts')
    expect(circular.eject).toEqual({ check: 'skott', fix: undefined })
  })

  it('scaffolds a bare CLI call when there are no default args', () => {
    const knip = defineExternalCheck({ name: 'unused-code', description: '', bin: 'knip', checkCommand: 'knip', devDeps: [] })
    expect(knip.scaffold.script).toBe('verifyx unused-code')
  })
})

describe('runCountedBudget', () => {
  const spec = { name: 'duplicate-code', bin: 'jscpd', checkCommand: 'jscpd src', docs: 'https://x' }
  const budget = (count: number, report = '') => ({ strategy: 'count' as const, unit: 'clone', count: async () => ({ count, report }) })

  it('passes when the finding count is at or below the budget', async () => {
    expect(await runCountedBudget(spec, budget(5), 5, [], {})).toEqual({ name: 'duplicate-code', ok: true })
  })

  it('fails over budget, printing the counting run’s report instead of re-running the tool', async () => {
    const transformingSpec = { ...spec, transformOutput: (output: string) => output.toUpperCase() }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { result, output } = await runCaptured(() => runCountedBudget(transformingSpec, budget(6, 'clone report'), 5, [], {}))
      expect(result.ok).toBe(false)
      expect(output).toBe('CLONE REPORT')
    } finally {
      spy.mockRestore()
    }
  })

  it('fails loudly when counting throws instead of silently passing', async () => {
    const throwing = {
      strategy: 'count' as const,
      unit: 'clone',
      count: async (): Promise<{ count: number; report: string }> => {
        throw new Error('jscpd crashed')
      },
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const result = await runCountedBudget(spec, throwing, 5, [], {})
      expect(result.ok).toBe(false)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
