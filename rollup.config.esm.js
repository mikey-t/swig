
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'node:fs'

const tsconfigEsm = 'tsconfig.esm.json'
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
const replaceOptions = { preventAssignment: true, values: { '__VERSION__': version } }
const doNotMangleSymbols = ['series', 'innerSeries', 'parallel', 'innerParallel']

export default [
  // ESM lib
  {
    input: 'src/index.ts',
    output: {
      // file: 'dist/esm/index.js',
      dir: 'dist/esm',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm, declaration: true, declarationMap: true }),
      replace(replaceOptions),
      nodeResolve(),
      terser({
        mangle: {
          reserved: doNotMangleSymbols
        }
      })
    ]
  },
  // ESM CLI
  {
    input: 'src/swigCli.ts',
    output: {
      // file: 'dist/esm/swigCli.js',
      dir: 'dist/esm/',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm }),
      replace(replaceOptions),
      nodeResolve(),
      terser({
        mangle: {
          reserved: doNotMangleSymbols
        }
      })
    ]
  },
  // ESM CLI startup script
  {
    input: 'src/SwigStartupWrapper.ts',
    output: {
      // file: 'dist/SwigStartupWrapper.js',
      dir: 'dist/',
      format: 'esm',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigEsm }),
      replace(replaceOptions),
      nodeResolve(),
      terser({
        mangle: {
          reserved: doNotMangleSymbols
        }
      })
    ]
  }
]
