#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { log, possibleTaskFileNames, trace, yellow } from './Swig.js'
import { spawnSync } from 'node:child_process'

type ProjectType = 'esm' | 'commonjs'
type SwigfileExtension = 'mjs' | 'cjs' | 'js' | 'ts'

export default class SwigStartupWrapper {
  private swigfilePath: string = ''
  private swigfileName: string = ''
  private packageJsonType: ProjectType = 'commonjs'
  private swigfileExtension: SwigfileExtension = 'js'

  constructor() { }

  main() {
    trace('- SwigStartupWrapper is checking a few things...')

    this.populateSwigfilePathOrThrow()
    trace(`- swigfile: ${this.swigfilePath}`)
    trace(`- swigfile extension: ${this.swigfileExtension}`)

    this.populatePackageJsonTypeOrThrow()
    trace(`- package.json type: ${this.packageJsonType}`)

    this.warnIfPossibleSwigfileSyntaxMismatch()

    return this.spawnSwig()
  }

  private spawnSwig() {
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

    if (!fs.existsSync(swigScript)) {
      log(`The npm package 'swig-cli' must be installed for the swig command to work - install as a dev dependency with 'npm i -D swig-cli'`)
    }
    if (isTypescript && !fs.existsSync(tsNodeBin)) {
      throw new Error(`Swigfile.ts is typescript but ts-node was not found in node_modules - install as a dev dependency with 'npm i -D ts-node`)
    }

    const command = 'node'
    const spawnArgs = isTypescript ? [tsNodeBin, '-T', swigScript, ...preservedArgs] : [swigScript, ...preservedArgs]

    trace('- spawnArgs: ', spawnArgs)

    const result = spawnSync(command, spawnArgs, { stdio: 'inherit', shell: true })

    return result.status
  }

  private populateSwigfilePathOrThrow() {
    let swigfilePath: string
    for (const filename of possibleTaskFileNames) {
      swigfilePath = `./${filename}`
      if (fs.existsSync(swigfilePath)) {
        this.swigfilePath = swigfilePath
        this.swigfileName = path.basename(this.swigfilePath)
        this.swigfileExtension = this.swigfileName.split('.')[1] as SwigfileExtension
        return
      }
    }
    throw new Error(`Swigfile not found - can be one of the following: ${possibleTaskFileNames.join(', ')}`)
  }

  private populatePackageJsonTypeOrThrow() {
    const packageJsonPath = './package.json'
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('Missing package.json - cannot detect project type')
    }
    const packageJsonContents = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })
    const packageJson = JSON.parse(packageJsonContents)
    this.packageJsonType = packageJson.type && packageJson.type.toLowerCase() === 'module' ? 'esm' : 'commonjs'
  }

  private warnIfPossibleSwigfileSyntaxMismatch() {
    if (this.swigfileExtension === 'ts') {
      return
    }

    const swigfileContents = fs.readFileSync(this.swigfilePath, { encoding: 'utf-8' })
    if (!swigfileContents) {
      throw new Error(`Error parsing swigfile ${this.swigfilePath}`)
    }
    const swigfileContentsWithoutComments = this.stripComments(swigfileContents)

    const hasEsmSyntax = this.fileStringHasEsm(swigfileContentsWithoutComments)
    const hasCommonJsSyntax = this.fileStringHasCommonJs(swigfileContentsWithoutComments)

    if (this.swigfileExtension === 'mjs') {
      // .mjs can be used regardless of package.json "type", so we're only checking that syntax is indeed mjs
      if (hasEsmSyntax && !hasCommonJsSyntax) {
        return
      } else if (!hasEsmSyntax && !hasCommonJsSyntax) {
        this.logWarning(`could not detect whether ${this.swigfileName} has valid syntax - it should use ESM, but detected neither ESM nor CommonJS (you may not have added any exported functions or imported anything yet)`)
      } else if (!hasEsmSyntax && hasCommonJsSyntax) {
        this.logWarning(`${this.swigfileName} appears to use CommonJS syntax but the file has the '.${this.swigfileExtension}' file extension, which means it should be ESM syntax (or you could also just rename your swigfile to use the '.${this.swigfileExtension}' file extension)`)
      } else {
        this.logWarning(`${this.swigfileName} appears to have both ESM and CommonJS syntax, but it should have only ESM syntax because of the '.${this.swigfileExtension}' file extension`)
      }
    }

    if (this.swigfileExtension === 'cjs') {
      // .cjs can be used regardless of package.json "type", so we're only checking that syntax is indeed cjs
      if (!hasEsmSyntax && hasCommonJsSyntax) {
        return
      } else if (!hasEsmSyntax && !hasCommonJsSyntax) {
        this.logWarning(`could not detect whether ${this.swigfileName} has valid syntax - it should use CommonJS, but detected neither ESM nor CommonJS (you may not have added any exported functions or added any 'require()' statements yet)`)
      } else if (hasEsmSyntax && !hasCommonJsSyntax) {
        this.logWarning(`${this.swigfileName} appears to use ESM syntax but the file has the '.${this.swigfileExtension}' file extension, which means it should be CommonJS syntax (or you could also just rename your swigfile to use the '.${this.swigfileExtension}' file extension)`)
      } else {
        this.logWarning(`${this.swigfileName} appears to have both ESM and CommonJS syntax, but it should have only CommonJS syntax because of the '.${this.swigfileExtension}' file extension`)
      }
    }

    if (this.swigfileExtension === 'js') {
      // It depends on the package.json "type" is set to "module" or not that determines what syntax is allowed in the swigfile.js
      if (this.packageJsonType === 'esm') {
        if (hasEsmSyntax && !hasCommonJsSyntax) {
          return
        } else if (!hasEsmSyntax && !hasCommonJsSyntax) {
          this.logWarning(`could not detect whether ${this.swigfileName} has valid syntax - it should use ESM, but detected neither ESM nor CommonJS (you may not have added any exported functions or imported anything yet)`)
        } else if (!hasEsmSyntax && hasCommonJsSyntax) {
          this.logWarning(`${this.swigfileName} appears to use CommonJS syntax but package.json "type" is set to "module", which means it should be ESM syntax (you could remove the "type" property from package.json, or you could also just rename your swigfile to use the '.cjs' file extension)`)
        } else {
          this.logWarning(`${this.swigfileName} appears to have both ESM and CommonJS syntax, but package.json "type" is set to "module", which means it should have only ESM syntax`)
        }
      } else { // packageJsonType === 'commonjs'
        if (!hasEsmSyntax && hasCommonJsSyntax) {
          return
        } else if (!hasEsmSyntax && !hasCommonJsSyntax) {
          this.logWarning(`could not detect whether ${this.swigfileName} has valid syntax - it should use CommonJS, but detected neither ESM nor CommonJS (you may not have added any exported functions or added any 'require()' statements yet)`)
        } else if (hasEsmSyntax && !hasCommonJsSyntax) {
          this.logWarning(`${this.swigfileName} appears to use ESM syntax but package.json "type" is not set to "module", which means it should be CommonJS syntax (you can change your package.json "type" to "module" or you could also just rename your swigfile to use the '.mjs' file extension)`)
        } else {
          this.logWarning(`${this.swigfileName} appears to have both ESM and CommonJS syntax, but package.json "type" is not set to "module", which means it should have only CommonJS syntax`)
        }
      }
    }
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
    log(`\n${yellow('Warning:')} ${str}\n`)
  }
}

try {
  new SwigStartupWrapper().main()
} catch (err) {
  console.error(err)
  process.exit(1)
}

process.exit(0)
