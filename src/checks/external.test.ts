import { describe, expect, it, vi } from 'vitest'

import { runCaptured } from '../shared/output.ts'
import { defineExternalCheck, externalFailureHint, runCountedBudget, selectCommand } from './external.ts'

const fixable = { checkCommand: ['oxfmt', '--check', '.'], fixCommand: ['oxfmt', '.'] }
const notFixable = { checkCommand: ['tsc', '--noEmit'] }

describe('selectCommand', () => {
  it('uses the fix command in fix mode when the check is fixable', () => {
    expect(selectCommand(fixable, 'fix')).toEqual(['oxfmt', '.'])
  })

  it('uses the check command in check mode', () => {
    expect(selectCommand(fixable, 'check')).toEqual(['oxfmt', '--check', '.'])
  })

  it('always uses the check command when the check has no fix command', () => {
    expect(selectCommand(notFixable, 'fix')).toEqual(['tsc', '--noEmit'])
    expect(selectCommand(notFixable, 'check')).toEqual(['tsc', '--noEmit'])
  })
})

describe('externalFailureHint', () => {
  it('names the tool, the exact argv that ran, and the docs link', () => {
    const hint = externalFailureHint({ name: 'unused-code', bin: 'knip', docs: 'https://knip.dev' }, ['knip', '--no-progress'])
    expect(hint).toContain('unused-code')
    expect(hint).toContain('knip')
    expect(hint).toContain('["knip","--no-progress"]')
    expect(hint).toContain('https://knip.dev')
  })

  it('still names the tool and command when no docs link is set', () => {
    const hint = externalFailureHint({ name: 'circular-deps', bin: 'skott' }, ['skott', 'src'])
    expect(hint).toContain('skott')
    expect(hint).toContain('["skott","src"]')
    expect(hint).not.toContain('undefined')
  })
})

describe('defineExternalCheck', () => {
  it('exposes raw commands for eject, including the fix variant when fixable', () => {
    const lint = defineExternalCheck({
      name: 'lint',
      description: '',
      bin: 'oxlint',
      checkCommand: ['oxlint', '.'],
      fixCommand: ['oxlint', '--fix', '.'],
      devDeps: [],
    })
    expect(lint.eject).toEqual({ check: 'oxlint .', fix: 'oxlint --fix .' })
  })

  it('scaffolds a bare CLI call and serializes argv only at the eject boundary', () => {
    const circular = defineExternalCheck({
      name: 'circular-deps',
      description: '',
      bin: 'skott',
      checkCommand: ['skott'],
      devDeps: [],
    })
    expect(circular.scaffold.script).toBe('verifyx circular-deps')
    expect(circular.eject).toEqual({ check: 'skott', fix: undefined })
  })

  it('scaffolds a bare CLI call when there are no default args', () => {
    const knip = defineExternalCheck({ name: 'unused-code', description: '', bin: 'knip', checkCommand: ['knip'], devDeps: [] })
    expect(knip.scaffold.script).toBe('verifyx unused-code')
  })
})

describe('runCountedBudget', () => {
  const spec = { name: 'duplicate-code', bin: 'jscpd', checkCommand: ['jscpd', 'src'], docs: 'https://x' }
  const budget = (count: number, report = '') => ({ strategy: 'count' as const, unit: 'clone', count: async () => ({ count, report }) })

  it('passes when the finding count is at or below the budget', async () => {
    expect(await runCountedBudget(spec, budget(5), 5, [], {})).toEqual({ name: 'duplicate-code', ok: true })
  })

  it('passes one prebuilt argv, including passthrough args, to the counter', async () => {
    const count = vi.fn(async () => ({ count: 0, report: '' }))
    await runCountedBudget(spec, { strategy: 'count', unit: 'clone', count }, 5, ['--ignore', 'has space'], {})
    expect(count).toHaveBeenCalledWith({ argv: ['jscpd', 'src', '--ignore', 'has space'], env: {} })
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
