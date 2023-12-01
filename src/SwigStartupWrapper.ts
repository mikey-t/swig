#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import Swig, { log, possibleTaskFileNames, red, trace, yellow } from './Swig.js'
import { spawn } from 'node:child_process'

type ProjectType = 'esm' | 'commonjs'
type SwigfileExtension = 'mjs' | 'cjs' | 'js' | 'ts'

export default class SwigStartupWrapper {
  private swigfilePath: string = ''
  private swigfileName: string = ''
  private packageJsonType: ProjectType = 'commonjs'
  private swigfileExtension: SwigfileExtension = 'js'
  private hasTsx: boolean = false

  constructor() { }

  main(): Promise<SpawnResult> {
    trace('- SwigStartupWrapper is checking a few things...')

    const hasSwigfile = this.populateSwigfile()
    if (hasSwigfile) {
      trace(`- swigfile: ${this.swigfilePath}`)
      trace(`- swigfile extension: ${this.swigfileExtension}`)
    }

    this.populatePackageJsonTypeOrThrow()
    trace(`- package.json type: ${this.packageJsonType}`)

    if (hasSwigfile) {
      this.warnIfPossibleSwigfileSyntaxMismatch()
    } else {
      trace(`- swigfile not found - skipping syntax check`)
    }

    return this.spawnSwig()
  }

  private async spawnSwig(): Promise<SpawnResult> {
    const preservedArgs = process.argv.slice(2)
    const isTypescript = this.swigfileExtension === 'ts'

    const swigScriptEsm = './node_modules/swig-cli/dist/esm/swigCli.js'
    const swigScriptCjs = './node_modules/swig-cli/dist/cjs/swigCli.cjs'
    const tsNodeBinCjs = './node_modules/ts-node/dist/bin.js'
    const tsNodeBinEsm = './node_modules/ts-node/dist/bin-esm.js'
    let swigScript = swigScriptEsm
    let tsNodeBin = tsNodeBinEsm

    if (isTypescript && this.packageJsonType === 'esm') {
      swigScript = swigScriptEsm
      tsNodeBin = tsNodeBinEsm
    } else if (isTypescript && this.packageJsonType === 'commonjs') {
      swigScript = swigScriptCjs
      tsNodeBin = tsNodeBinCjs
    }

    if (isTypescript && !this.hasTsx && !fs.existsSync(tsNodeBin)) {
      this.exitWithError(`typescript detected but a dev dependency is missing.\nChoose and install either tsx or ts-node using 'npm i -D tsx' or 'npm i -D ts-node'.`)
    }

    const nodeVersion = parseVersion(process.version)
    trace(`NodeJS version: ${nodeVersion?.raw}`)

    const command = 'node'
    let spawnArgs = [swigScript, ...preservedArgs]
    if (isTypescript && this.hasTsx) {
      const tsxVersion = getTsxVersion()
      let loaderFlag = '--import'
      // NodeJS < 18.19 requires the old "--loader" flag
      if (nodeVersion && isNodeLessThan18Dot19(nodeVersion)) {
        loaderFlag = '--loader'
      }
      if (loaderFlag === '--import') {
        if (!tsxVersion || tsxVersion.major < 4) {
          this.logWarning(`You may need to upgrade your tsx version to at least 4.x for typescript functionality to work with your version of NodeJS.`)
        }
        if (this.packageJsonType === 'commonjs') {
          this.logWarning(`Using tsx with a CommonJS project is not fully supported - try ts-node instead, or re-configure your project to use ESM`)
        }
      }

      spawnArgs = ['--no-warnings', loaderFlag, 'tsx', ...spawnArgs]
    } else if (isTypescript && this.packageJsonType === 'esm') {
      // ts-node is super broken for loaders and esm (and has been for a long time...) - this is the best we can do for now for the new node 18.19 issues
      if (nodeVersion && isNodeLessThan18Dot19(nodeVersion)) {
        spawnArgs = [tsNodeBin, '-T', swigScript, ...preservedArgs]
      } else {
        spawnArgs = ['--no-warnings', '--experimental-loader', 'ts-node/esm', swigScript, ...preservedArgs]
      }
    } else if (isTypescript) {
      spawnArgs = [tsNodeBin, '-T', swigScript, ...preservedArgs]
    }

    trace(`- swig-cli spawn command: ${command} ${spawnArgs.join(' ')}`)

    return this.spawnSwigCliAsync(command, spawnArgs)
  }

  private populateSwigfile(): boolean {
    let swigfilePath: string
    for (const filename of possibleTaskFileNames) {
      swigfilePath = `./${filename}`
      if (fs.existsSync(swigfilePath)) {
        this.swigfilePath = swigfilePath
        this.swigfileName = path.basename(this.swigfilePath)
        this.swigfileExtension = this.swigfileName.split('.')[1] as SwigfileExtension
        return true
      }
    }

    return false
  }

  private populatePackageJsonTypeOrThrow() {
    const packageJsonPath = './package.json'
    if (!fs.existsSync(packageJsonPath)) {
      this.exitWithError('no package.json found - cannot detect project type')
    }
    const packageJsonContents = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })
    const packageJson = JSON.parse(packageJsonContents)
    this.packageJsonType = packageJson.type && packageJson.type.toLowerCase() === 'module' ? 'esm' : 'commonjs'

    // Check that swig-cli is installed as a dependency or devDependency
    if ((packageJson.devDependencies && packageJson.devDependencies['swig-cli']) || (packageJson.dependencies && packageJson.dependencies['swig-cli'])) {
      trace('- swig-cli is installed as a dependency in the project')
    } else {
      this.exitWithError(`swig-cli was not found in the project dependencies or devDependencies - install with: npm i -D swig-cli`)
    }

    if ((packageJson.devDependencies && packageJson.devDependencies['tsx']) || (packageJson.dependencies && packageJson.dependencies['tsx'])) {
      this.hasTsx = true
      trace('- tsx is installed as a dependency in the project')
    }
  }

  private warnIfPossibleSwigfileSyntaxMismatch() {
    const swigfileContents = fs.readFileSync(this.swigfilePath, { encoding: 'utf-8' })

    if (swigfileContents.trim() === '') return

    const swigfileContentsWithoutComments = this.stripComments(swigfileContents)

    const hasEsmSyntax = this.fileStringHasEsm(swigfileContentsWithoutComments)
    const hasCommonJsSyntax = this.fileStringHasCommonJs(swigfileContentsWithoutComments)
    const hasBoth = hasEsmSyntax && hasCommonJsSyntax

    // Don't warn - it might just be a new project with nothing exported or imported yet
    if (!hasEsmSyntax && !hasCommonJsSyntax) return

    // Typescript allows both cjs and esm syntax, even mixed - as long as the package.json type is commonjs
    if (this.swigfileExtension === 'ts' && this.packageJsonType === 'commonjs') return

    if (this.swigfileExtension === 'ts' && this.packageJsonType === 'esm' && (hasBoth || hasCommonJsSyntax)) {
      this.logWarning(`${this.swigfileName} needs to use only ESM syntax if the package.json type is set to "module".`)
      this.logOptionsMatrix()
      return
    }

    if (hasBoth) {
      this.logWarning(`${this.swigfileName} appears to have both ESM and CommonJS syntax, but it should have only one or the other.`)
      this.logOptionsMatrix()
      return
    }

    if (this.swigfileExtension === 'mjs' && hasEsmSyntax && !hasCommonJsSyntax) return
    if (this.swigfileExtension === 'cjs' && !hasEsmSyntax && hasCommonJsSyntax) return
    if (this.swigfileExtension === 'js' && this.packageJsonType === 'esm' && hasEsmSyntax) return
    if (this.swigfileExtension === 'js' && this.packageJsonType === 'commonjs' && hasCommonJsSyntax) return
    if (this.swigfileExtension === 'ts' && this.packageJsonType === 'commonjs') return
    if (this.swigfileExtension === 'ts' && this.packageJsonType === 'esm' && hasEsmSyntax) return

    this.logWarning(`${this.swigfileExtension} appears to use ${hasEsmSyntax ? 'ESM' : 'CommonJS'} syntax and your package.json type is set to ${this.packageJsonType}.`)
    this.logOptionsMatrix()
  }

  private fileStringHasEsm(fileContent: string): boolean {
    const esmPatterns = [
      /^\s*import\s+\w+\s+from\s+['"].+['"]/m,  // import x from 'x'
      /^\s*import\s*\{[^}]+\}\s+from\s+['"].+['"]/m,  // import { x } from 'x'
      /^\s*export\s+const\s+\w+/m,  // export const x
      /^\s*export\s+default\s+\w+/m,  // export default x
      /^\s*export\s+function\s+\w+/m,  // export function x
      /^\s*export\s+class\s+\w+/m  // export class x
    ]

    return esmPatterns.some(pattern => pattern.test(fileContent))
  }

  private fileStringHasCommonJs(fileContent: string): boolean {
    const commonJsPatterns = [
      /^\s*const\s+\w+\s+=\s+require\(['"].+['"]\)/m,  // const x = require('x')
      /^\s*module\.exports\s+=/m,  // module.exports =
      /^\s*exports\.\w+\s+=/m  // exports.x =
    ]

    return commonJsPatterns.some(pattern => pattern.test(fileContent))
  }

  private stripComments(content: string): string {
    return content.replace(/\/\/.*$|\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '')
  }

  private logWarning(str: string) {
    log(`${yellow('[swig-cli] Warning:')} ${str}`)
  }

  private exitWithError(message: string) {
    log(`${red('[swig-cli] Error:')} ${message}`)
    process.exit(1)
  }

  private logOptionsMatrix() {
    const optionsData = [
      ['swigfile', 'package.json type', 'syntax', 'notes'],
      ['.cjs', 'any', 'CommonJS', ''],
      ['.mjs', 'any', 'ESM', ''],
      ['.js', 'module', 'ESM', ''],
      ['.js', 'commonjs', 'CommonJS', ''],
      ['.ts', 'module', 'ESM', 'can be affected by tsconfig.json settings'],
      ['.ts', 'commonjs', 'CommonJS and/or ESM', 'can be affected by tsconfig.json settings - tsx is not supported in this case (use ts-node)']
    ]
    log('\nAvailable configurations:\n')
    this.logTable(optionsData)
    log('')
  }

  private logTable(data: string[][]): void {
    if (data.length === 0 || data[0].length === 0) return

    const numColumns = data[0].length
    const columnWidths: number[] = []
    for (let i = 0; i < numColumns; i++) {
      columnWidths[i] = Math.max(...data.map(row => row[i]?.length || 0))
    }

    const lineSeparator = ' ' + columnWidths.map(width => '-'.repeat(width)).join(' + ')

    for (let i = 0; i < data.length; i++) {
      const paddedRowArray = data[i].map((cell, colIdx) => cell.padEnd(columnWidths[colIdx], ' '))
      log(' ' + paddedRowArray.join(' | '))
      if (i === 0) log(lineSeparator)
    }
  }

  private spawnSwigCliAsync(command: string, args: string[]): Promise<SpawnResult> {
    return new Promise((resolve) => {
      const result: SpawnResult = { code: 1 }
      const prefix = `[spawnSwigCliAsync] `

      const child = spawn(command, args, { stdio: 'inherit' })
      const childId = child.pid
      if (!childId) {
        trace(`${prefix}ChildProcess pid is undefined - spawn failed - an error event should be emitted shortly`)
      }

      const exitListener = (code: number) => {
        child.kill()
        child.unref()
        result.code = code
        resolve(result)
      }
      process.on('exit', exitListener)

      const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT']

      const signalListener = (signal: NodeJS.Signals) => {
        trace(`${prefix}Process received ${signal} - killing ChildProcess with ID ${childId}`)
        child.kill(signal)
      }

      signals.forEach((signal) => {
        process.on(signal, signalListener)
      })

      child.on('exit', (code, signal) => {
        trace(`${prefix}ChildProcess exited with code ${code} and signal ${signal}`)
        result.code = code ?? 1
        process.removeListener('exit', exitListener)
        signals.forEach((signal) => {
          process.removeListener(signal, signalListener)
        })
        child.removeAllListeners()
        resolve(result)
      })

      child.on('error', (error) => {
        throw error
      })
    })
  }
}

interface SimpleVersion {
  raw: string
  major: number
  minor: number
  patch: number
}

function parseVersion(rawVersionString: string): SimpleVersion | undefined {
  if (!rawVersionString) {
    throw new Error(`rawVersionString is required`)
  }
  try {
    const parts = rawVersionString.replace(/[^0-9.]/g, '').split('.')
    return {
      raw: rawVersionString,
      major: parts.length > 0 ? parseInt(parts[0], 10) : 0,
      minor: parts.length > 1 ? parseInt(parts[1], 10) : 0,
      patch: parts.length > 2 ? parseInt(parts[2], 10) : 0
    }
  } catch (err) {
    trace(`unable to determine NodeJS version`, err)
    return undefined
  }
}

function getTsxVersion(): SimpleVersion | undefined {
  try {
    const packageJsonPath = './node_modules/tsx/package.json'
    if (!fs.existsSync(packageJsonPath)) {
      return undefined
    }
    const packageJsonContents = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })
    const packageJson = JSON.parse(packageJsonContents)
    const versionString = packageJson.version
    return parseVersion(versionString)
  } catch (err) {
    trace(`error getting tsx version`, err)
    return undefined
  }
}

function isNodeLessThan18Dot19(nodeVersion: SimpleVersion): boolean {
  return nodeVersion.major < 18 || (nodeVersion.major === 18 && nodeVersion.minor < 19)
}

interface SpawnResult {
  code: number
  error?: Error
}

const firstArg = process.argv.slice(2)[0]
if (['h', 'help', '-h', '--help', 'v', 'version', '-v', '--version'].includes(firstArg)) {
  // If first arg is version or help, skip all checks and go straight to
  // calling Swig since all it needs to do is print some text and exit.
  trace(`- SwigStartupWrapper is skipping checks because the command is ${firstArg}`)
  new Swig().runMainAsync()
} else {
  new SwigStartupWrapper().main()
    .then((result: SpawnResult) => {
      if (result.error) {
        console.error(result.error)
      }
      process.exit(result.code)
    }
    ).catch(err => {
      console.error(err)
      process.exit(42)
    })
}
