export const color = {
  red: (s: string | number) => `\x1b[31m${s}\x1b[39m`,
  green: (s: string | number) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string | number) => `\x1b[33m${s}\x1b[39m`,
  magenta: (s: string | number) => `\x1b[35m${s}\x1b[39m`,
  cyan: (s: string | number) => `\x1b[36m${s}\x1b[39m`,
  dim: (s: string | number) => `\x1b[2m${s}\x1b[22m`,
  bold: (s: string | number) => `\x1b[1m${s}\x1b[22m`,
  heading: (s: string | number) => `\x1b[1m\x1b[4m${s}\x1b[24m\x1b[22m`,
}

/**
 * Paint a whole block red, re-asserting red after any foreground-colour reset the text already contains
 * (e.g. a tool's own ANSI codes) so the highlight survives to the end instead of being cancelled partway.
 */
export function paintRed(text: string): string {
  return `\x1b[31m${text.replaceAll('\x1b[39m', '\x1b[31m')}\x1b[39m`
}

/** Drop red-foreground codes from text so a tool's hardcoded red renders in the terminal's default colour. */
export function withoutRed(text: string): string {
  return text.replaceAll('\x1b[31m', '')
}
