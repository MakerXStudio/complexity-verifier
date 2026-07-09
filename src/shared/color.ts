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
