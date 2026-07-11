import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { installDevDeps, type Runner } from './installDeps.ts'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-install-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'scratch' }))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

/** A runner that records the commands it saw and returns 0 unless the command mentions a `fail`-listed package. */
function fakeRunner(failFor: string[] = []): Runner & { commands: string[] } {
  const commands: string[] = []
  const run: Runner = (command) => {
    commands.push(command)
    return Promise.resolve(failFor.some((pkg) => command.includes(pkg)) ? 1 : 0)
  }
  return Object.assign(run, { commands })
}

describe('installDevDeps', () => {
  it('installs missing deps in a single batch on the happy path', async () => {
    const run = fakeRunner()
    const report = await installDevDeps(['oxlint', 'knip'], dir, run)

    expect(report).toEqual({ skipped: [], installed: ['oxlint', 'knip'], failed: [] })
    expect(run.commands).toEqual(['npm install --save-dev oxlint knip'])
  })

  it('skips deps already declared in package.json (any dependency field)', async () => {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { typescript: '^5.0.0' }, peerDependencies: { oxlint: '*' } }),
    )
    const run = fakeRunner()
    const report = await installDevDeps(['typescript', 'oxlint', 'knip'], dir, run)

    expect(report.skipped).toEqual(['typescript', 'oxlint'])
    expect(report.installed).toEqual(['knip'])
    expect(run.commands).toEqual(['npm install --save-dev knip'])
  })

  it('skips deps present in node_modules even when not declared', async () => {
    fs.mkdirSync(path.join(dir, 'node_modules', 'oxlint'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'node_modules', 'oxlint', 'package.json'), '{}')
    const run = fakeRunner()
    const report = await installDevDeps(['oxlint', 'knip'], dir, run)

    expect(report.skipped).toEqual(['oxlint'])
    expect(report.installed).toEqual(['knip'])
  })

  it('runs no install command when everything is already present', async () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: { oxlint: '*', knip: '*' } }))
    const run = fakeRunner()
    const report = await installDevDeps(['oxlint', 'knip'], dir, run)

    expect(report).toEqual({ skipped: ['oxlint', 'knip'], installed: [], failed: [] })
    expect(run.commands).toEqual([])
  })

  it('falls back to per-package installs and isolates the failure when the batch fails', async () => {
    const run = fakeRunner(['oxlint'])
    const report = await installDevDeps(['oxlint', 'knip', 'skott'], dir, run)

    expect(report.skipped).toEqual([])
    expect(report.installed).toEqual(['knip', 'skott'])
    expect(report.failed).toEqual(['oxlint'])
    // batch first, then one command per package to isolate the culprit
    expect(run.commands).toEqual([
      'npm install --save-dev oxlint knip skott',
      'npm install --save-dev oxlint',
      'npm install --save-dev knip',
      'npm install --save-dev skott',
    ])
  })
})
