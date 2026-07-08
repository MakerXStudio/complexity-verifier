#!/usr/bin/env node
import { run } from './cli-core.ts'

process.exit(run(process.argv.slice(2)))
