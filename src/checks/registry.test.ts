import { describe, expect, it } from 'vitest'

import { CHECKS, defaultChecks, getCheck } from './registry.ts'

describe('check registry', () => {
  it('includes the native and external checks', () => {
    const names = CHECKS.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'complexity',
        'comment-block',
        'block-comments',
        'hardcoded-colors',
        'forbidden-strings',
        'knip',
        'circular-deps',
        'duplicate-code',
        'lint',
      ]),
    )
  })

  it('marks external tool checks with scaffold devDeps', () => {
    const knip = getCheck('knip')
    expect(knip?.kind).toBe('external')
    expect(knip?.scaffold.devDeps).toContain('knip')
  })

  it('scaffolds native checks back into the verify CLI', () => {
    expect(getCheck('complexity')?.scaffold.script).toBe('verify complexity')
  })

  it('returns undefined for unknown checks', () => {
    expect(getCheck('nope')).toBeUndefined()
  })

  it('every default check is in the registry', () => {
    for (const check of defaultChecks()) expect(CHECKS).toContain(check)
  })
})
