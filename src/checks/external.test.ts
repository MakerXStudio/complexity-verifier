import { describe, expect, it } from 'vitest'

import { selectCommand } from './external.ts'

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
