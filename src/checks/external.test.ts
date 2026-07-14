import { describe, expect, it, vi } from 'vitest'

import { appendArgs, defineExternalCheck, externalFailureHint, runCountedBudget, selectCommand } from './external.ts'

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

describe('appendArgs', () => {
  it('appends passthrough args verbatim, unquoted (so shell globs still expand)', () => {
    expect(appendArgs('skott --showCircularDependencies', ['src/*.ts'])).toBe('skott --showCircularDependencies src/*.ts')
  })

  it('returns the command unchanged when there are no extra args', () => {
    expect(appendArgs('oxlint .', [])).toBe('oxlint .')
    expect(appendArgs('oxlint .')).toBe('oxlint .')
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
  const budget = (count: () => Promise<number>) => ({ strategy: 'count' as const, unit: 'clone', count: () => count() })

  it('passes when the finding count is at or below the budget, without running the display command', async () => {
    expect(
      await runCountedBudget(
        spec,
        budget(async () => 5),
        5,
        [],
        {},
      ),
    ).toEqual({ name: 'duplicate-code', ok: true })
  })

  it('fails when the finding count exceeds the budget', async () => {
    const displaySpec = { ...spec, checkCommand: 'node -e ""' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(
        (
          await runCountedBudget(
            displaySpec,
            budget(async () => 6),
            5,
            [],
            {},
          )
        ).ok,
      ).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('fails loudly when counting throws instead of silently passing', async () => {
    const throwing = budget(async () => {
      throw new Error('jscpd crashed')
    })
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
