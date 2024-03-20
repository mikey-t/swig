
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'node:fs'

const tsconfigEsm = 'tsconfig.esm.json'
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
const replaceOptions = { '__VERSION__': version, preventAssignment: true }

export default [
  // ESM lib
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm, declaration: true, declarationMap: true }),
      nodeResolve(),
      terser(),
      replace(replaceOptions)
    ]
  },
  // ESM CLI
  {
    input: 'src/swigCli.ts',
    output: {
      file: 'dist/esm/swigCli.js',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm }),
      nodeResolve(),
      terser(),
      replace(replaceOptions)
    ]
  },
  // ESM CLI startup script
  {
    input: 'src/SwigStartupWrapper.ts',
    output: {
      file: 'dist/SwigStartupWrapper.js',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm }),
      nodeResolve(),
      terser(),
      replace(replaceOptions)
    ]
  }
]
