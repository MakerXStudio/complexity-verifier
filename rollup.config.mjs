import typescript from '@rollup/plugin-typescript'

// Any import that is not an explicit relative path is a bare module (a dependency
// or a Node builtin) and must stay external so deps are not bundled.
const isBareModuleImport = (id) => !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(id)

export default {
  input: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  external: isBareModuleImport,
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].mjs',
    chunkFileNames: '[name]-[hash].mjs',
    preserveModules: true,
    preserveModulesRoot: 'src',
    sourcemap: true,
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.build.json',
      // Rollup names the .mjs output; keep declarations flat under dist to match.
      compilerOptions: {
        module: 'NodeNext',
        rootDir: 'src',
        outDir: 'dist',
        declarationDir: 'dist',
      },
    }),
  ],
}
