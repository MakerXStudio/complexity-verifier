import fs from 'node:fs'
import path from 'node:path'

import { type Command, type Node, parse, type Script, type Word } from 'unbash'

type PackageJson = {
  scripts?: Record<string, string>
} & Partial<Record<(typeof DEP_FIELDS)[number], Record<string, string>>>

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

// context: tools knip flags as unlisted binaries because they are system-installed, not npm bins, and are
// missing from knip's own IGNORED_GLOBAL_BINARIES (which already covers git, docker, aws, cargo, ...).
const SYSTEM_BINARIES = [
  'az',
  'dotnet',
  'gcloud',
  'go',
  'helm',
  'kubectl',
  'make',
  'pip',
  'pip3',
  'pipx',
  'poetry',
  'python',
  'python3',
  'ruby',
  'terraform',
  'uv',
  'uvx',
]

const SPAWNING_BINARIES = new Set(['cross-env', 'retry-cli'])

export function detectSystemBinaries(cwd: string): string[] {
  const pkgPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(pkgPath)) return []
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PackageJson
  const invoked = new Set<string>()
  for (const script of Object.values(pkg.scripts ?? {})) {
    collectInvokedBinaries(script, invoked)
  }
  const declared = new Set(DEP_FIELDS.flatMap((field) => Object.keys(pkg[field] ?? {})))
  return SYSTEM_BINARIES.filter(
    (bin) => invoked.has(bin) && !declared.has(bin) && !fs.existsSync(path.join(cwd, 'node_modules', '.bin', bin)),
  )
}

function collectInvokedBinaries(script: string, invoked: Set<string>): void {
  try {
    collectInvokedBinariesFromScript(parse(script), invoked, new Set())
  } catch {
    return
  }
}

function collectInvokedBinariesFromScript(script: Script, invoked: Set<string>, definedFunctions: Set<string>): void {
  for (const statement of script.commands) {
    if (statement.command.type === 'Function') definedFunctions.add(statement.command.name.text)
  }

  for (const statement of script.commands) {
    for (const command of walkCommands(statement)) {
      if (command.name) collectExpansionBinaries(command.name, invoked, definedFunctions)
      for (const prefix of command.prefix) {
        if (prefix.value) collectExpansionBinaries(prefix.value, invoked, definedFunctions)
      }
      for (const suffix of command.suffix) collectExpansionBinaries(suffix, invoked, definedFunctions)

      const binary = command.name?.value
      if (!binary || definedFunctions.has(binary)) continue
      invoked.add(binary)
      if (SPAWNING_BINARIES.has(binary)) {
        collectInvokedBinaries(
          command.suffix
            .filter((word) => word.text !== '--')
            .map((word) => word.text)
            .join(' '),
          invoked,
        )
      }
    }
  }
}

function* walkCommands(node: Node): Generator<Command> {
  switch (node.type) {
    case 'Command':
      yield node
      break
    case 'AndOr':
    case 'Pipeline':
      for (const command of node.commands) yield* walkCommands(command)
      break
    case 'If':
      yield* walkCommands(node.clause)
      yield* walkCommands(node.then)
      if (node.else) yield* walkCommands(node.else)
      break
    case 'For':
    case 'ArithmeticFor':
    case 'Select':
    case 'Subshell':
    case 'BraceGroup':
      yield* walkCommands(node.body)
      break
    case 'While':
      yield* walkCommands(node.clause)
      yield* walkCommands(node.body)
      break
    case 'CompoundList':
      for (const statement of node.commands) yield* walkCommands(statement)
      break
    case 'Case':
      for (const item of node.items) yield* walkCommands(item.body)
      break
    case 'Function':
    case 'Coproc':
      yield* walkCommands(node.body)
      break
    case 'Statement':
      yield* walkCommands(node.command)
      break
  }
}

function collectExpansionBinaries(word: Word, invoked: Set<string>, definedFunctions: Set<string>): void {
  for (const part of word.parts ?? []) {
    if ((part.type === 'CommandExpansion' || part.type === 'ProcessSubstitution') && part.script) {
      collectInvokedBinariesFromScript(part.script, invoked, definedFunctions)
    } else if (part.type === 'DoubleQuoted' || part.type === 'LocaleString') {
      for (const child of part.parts) {
        if (child.type === 'CommandExpansion' && child.script) {
          collectInvokedBinariesFromScript(child.script, invoked, definedFunctions)
        }
      }
    }
  }
}
