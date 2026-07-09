import fs from 'node:fs'

type PackageJson = { scripts?: Record<string, string> } & Record<string, unknown>

/**
 * Add the given `verify:*` scripts to package.json without clobbering existing ones, and ensure a top-level
 * `verify` script (`topScript`) that invokes the CLI. Returns the names of scripts actually added.
 */
export function addVerifyScripts(packageJsonPath: string, scripts: Record<string, string>, topScript = 'verifyx'): string[] {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson
  const existing = pkg.scripts ?? {}
  const added: string[] = []

  for (const [name, body] of Object.entries(scripts)) {
    if (existing[name] === undefined) {
      existing[name] = body
      added.push(name)
    }
  }
  if (existing.verify === undefined) {
    existing.verify = topScript
    added.push('verify')
  }

  pkg.scripts = existing
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`)
  return added
}

/**
 * Set the given scripts in package.json, overwriting any existing bodies. Used by `verifyx eject`, which
 * deliberately replaces a `verifyx <name>` wrapper script with the underlying raw tool command.
 */
export function setScripts(packageJsonPath: string, scripts: Record<string, string>): void {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson
  pkg.scripts = { ...pkg.scripts, ...scripts }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`)
}
