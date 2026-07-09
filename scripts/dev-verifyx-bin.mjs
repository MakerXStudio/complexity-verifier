// Dev-only: create a local `verifyx` bin that proxies `node src/cli.ts`, so this repo's package.json can use
// `verifyx <check>` exactly like a consumer's. Wired via `prepare`, so it runs on local install / before
// publish but never when @makerx/verify is installed as a registry dependency.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const binDir = path.join(repoRoot, 'node_modules', '.bin')

// Nothing to link into until dependencies are installed.
if (!fs.existsSync(path.join(repoRoot, 'node_modules'))) process.exit(0)

const cliNative = path.join(repoRoot, 'src', 'cli.ts')
const cliPosix = cliNative.split(path.sep).join('/')

fs.mkdirSync(binDir, { recursive: true })

fs.writeFileSync(path.join(binDir, 'verifyx'), `#!/bin/sh\nexec node "${cliPosix}" "$@"\n`)
fs.chmodSync(path.join(binDir, 'verifyx'), 0o755)
fs.writeFileSync(path.join(binDir, 'verifyx.cmd'), `@node "${cliNative}" %*\r\n`)
fs.writeFileSync(path.join(binDir, 'verifyx.ps1'), `#!/usr/bin/env pwsh\nnode "${cliPosix}" $args\nexit $LASTEXITCODE\n`)

process.stdout.write('dev bin ready: node_modules/.bin/verifyx -> node src/cli.ts\n')
