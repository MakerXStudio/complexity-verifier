import { describe, expect, it } from 'vitest'

import { externalFailureHint, selectCommand } from './external.ts'

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
