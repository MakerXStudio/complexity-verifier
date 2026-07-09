import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyEject, ejectScripts } from './eject.ts'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-eject-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function writePkg(scripts: Record<string, string>): void {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'scratch', scripts }))
}
function readScripts(): Record<string, string> {
  return (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { scripts: Record<string, string> }).scripts
}

describe('ejectScripts', () => {
  it('inlines the raw check command, plus a :fix variant for fixable tools', () => {
    expect(ejectScripts('lint')).toEqual({ 'verify:lint': 'oxlint .', 'verify:lint:fix': 'oxlint --fix .' })
  })

  it('inlines only the check command for a non-fixable tool', () => {
    expect(ejectScripts('circular-deps')).toEqual({
      'verify:circular-deps': 'skott --displayMode=raw --showCircularDependencies --exitCodeOnCircularDependencies=1',
    })
  })

  it('refuses to eject a native check', () => {
    expect(() => ejectScripts('complexity')).toThrow(/only external checks can be ejected/)
  })

  it('refuses to eject an unknown check', () => {
    expect(() => ejectScripts('nope')).toThrow(/Unknown check/)
  })
})

describe('applyEject', () => {
  it('overwrites the verifyx wrapper script with the raw tool command', () => {
    writePkg({ 'verify:lint': 'verifyx lint' })
    const result = applyEject(dir, 'lint')
    expect(result.scripts['verify:lint']).toBe('oxlint .')
    expect(readScripts()['verify:lint']).toBe('oxlint .')
    expect(readScripts()['verify:lint:fix']).toBe('oxlint --fix .')
  })

  it('leaves unrelated scripts untouched', () => {
    writePkg({ build: 'tsc', 'verify:circular-deps': 'verifyx circular-deps -- src/*.ts' })
    applyEject(dir, 'circular-deps')
    expect(readScripts().build).toBe('tsc')
    expect(readScripts()['verify:circular-deps']).toBe(
      'skott --displayMode=raw --showCircularDependencies --exitCodeOnCircularDependencies=1',
    )
  })
})
