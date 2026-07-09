import { describe, expect, it } from 'vitest'

import { paintRed, withoutRed } from './color.ts'

describe('withoutRed', () => {
  it('drops red-foreground codes so text renders in the default colour', () => {
    expect(withoutRed('\x1b[31mheader\x1b[39m')).toBe('header\x1b[39m')
  })

  it('leaves other colours (e.g. a tool table border) untouched', () => {
    expect(withoutRed('\x1b[90m│\x1b[39m\x1b[31m cell \x1b[39m')).toBe('\x1b[90m│\x1b[39m cell \x1b[39m')
  })
})

describe('paintRed', () => {
  it('wraps the text in red', () => {
    expect(paintRed('boom')).toBe('\x1b[31mboom\x1b[39m')
  })

  it("re-asserts red after an embedded foreground reset so the highlight isn't cancelled partway", () => {
    expect(paintRed('a\x1b[39mb')).toBe('\x1b[31ma\x1b[31mb\x1b[39m')
  })
})
