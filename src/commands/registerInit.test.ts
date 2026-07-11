import { describe, expect, it } from 'vitest'

import { type Choice, preSelected } from './registerInit.ts'

describe('preSelected', () => {
  // The interactive target/check prompts rely on this to pre-select defaults. enquirer's multiselect ignores each
  // choice's `enabled` for the submitted result (it only paints a marker) — a plain enter returns []; the enabled
  // names must be handed back as `initial`. See the comment in registerInit's `ask`. Verified end-to-end manually.
  it('returns the names of the enabled choices as the `initial` selection', () => {
    const choices: Choice[] = [
      { name: 'claude', message: 'Claude', enabled: true },
      { name: 'agents', message: 'Other agents', enabled: false },
    ]
    expect(preSelected(choices)).toEqual(['claude'])
  })

  it('returns every enabled choice and nothing else', () => {
    const choices: Choice[] = [
      { name: 'a', message: 'A', enabled: true },
      { name: 'b', message: 'B' },
      { name: 'c', message: 'C', enabled: false },
      { name: 'd', message: 'D', enabled: true },
    ]
    expect(preSelected(choices)).toEqual(['a', 'd'])
  })
})
