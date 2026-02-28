
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'node:fs'

const tsconfigCjs = 'tsconfig.cjs.json'
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version
const replaceOptions = { preventAssignment: true, values: { '__VERSION__': version } }
const doNotMangleSymbols = ['series', 'innerSeries', 'parallel', 'innerParallel']

export default [
  // CommonJS lib
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.cjs',
      format: 'cjs',
      sourcemap: 'inline'
    },
    plugins: [
      typescript({ tsconfig: tsconfigCjs, declaration: true, declarationMap: true, module: 'esnext' }),
      replace(replaceOptions),
      nodeResolve(),
      commonjs(),
      terser({
        mangle: {
          reserved: doNotMangleSymbols
        }
      })
    ]
  },
  // CommonJS CLI
  {
    input: 'src/swigCli.ts',
    output: {
      file: 'dist/cjs/swigCli.cjs',
      format: 'cjs',
      sourcemap: 'inline',
      dynamicImportInCjs: false
    },
    plugins: [
      typescript({ tsconfig: tsconfigCjs, module: 'esnext' }),
      nodeResolve(),
      commonjs(),
      terser({
        mangle: {
          reserved: doNotMangleSymbols
        }
      }),
      replace(replaceOptions)
    ]
  }
]
