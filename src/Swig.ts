import * as path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'node:url'

const showMode = false // Show ESM or CommonJS mode in log messages

export function log(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trace(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

/**
 * See {@link TaskOrNamedTask} for more info.
 */
export type Task = () => Promise<unknown>

/**
 * See {@link TaskOrNamedTask} for more info.
 */
export type NamedTask = [string, Task]

/**
 * ```javascript
 * Task | NamedTask
 * ```
 *   - Any function that is async or returns a Promise
 *   - A tuple (array with 2 values) of `[string, Task]` that can be used to provide a label for an anonymous function
 * 
 * Example use of {@link Swig#series} and {@link Swig#parallel} with {@link Task} and {@link NamedTask} params:
 * 
 * ```javascript
 * series(
 *   task1,
 *   ['task2', async () => {}],
 *   task3,
 *   parallel(task4, ['task5', async () => {}])
 * )
 * ```
 */
export type TaskOrNamedTask = Task | NamedTask

interface LogNameAndTask { logName: string, task: Task }

interface CommandDescriptor { id: string, names: string[], alternateNames: string[], description: string, example: string }

type TasksMap = [string, (() => void | Promise<void>)][]

class CliParam {
  value: string
  isCommand: boolean

  constructor(value: string, isCommand: boolean) {
    this.value = value
    this.isCommand = isCommand
  }

  matches: (commandDescriptor: CommandDescriptor) => boolean = (commandDescriptor: CommandDescriptor) => {
    return this.value === commandDescriptor.id
  }
}

export default class Swig {
  isCommonJS = typeof require === "function" && typeof module === "object" && module.exports
  isEsm = !this.isCommonJS
  private _versionString: string = '__VERSION__' // Set in build script in transpiled version of file
  private _cwd = process.cwd()
  private _seriesCounter = 1
  private _parallelCounter = 1
  private _possibleTaskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']
  private _listCommand = { id: 'list', names: ['list', 'ls', 'l'], alternateNames: ['-l', '--list'], description: 'List available tasks (default)', example: 'swig list' }
  private _helpCommand = { id: 'help', names: ['help', 'h'], alternateNames: ['-h', '--help'], description: 'Show help message', example: 'swig help' }
  private _versionCommand = { id: 'version', names: ['version', 'v'], alternateNames: ['-v', '--version'], description: 'Print version number', example: 'swig version' }
  private _filterCommand = { id: 'filter', names: ['filter', 'f'], alternateNames: ['-f', '--filter'], description: 'Filter and list tasks by name', example: 'swig filter pattern' }
  private _generateWrapperFilesCommand = { id: 'generateWrapperFiles', names: ['generateWrapperFiles', 'gw'], alternateNames: [], description: 'Generate wrapper files swig and swig.bat (optionally pass additional param \'ts-node\')', example: 'swig gw\n    swig gw ts-node' }
  private _commandDescriptors: CommandDescriptor[] = [
    { id: 'task', names: ['<taskName>'], alternateNames: [], description: 'Run a task, whish is an async function exported from your swigfile that returns a Task', example: 'swig functionName' },
    this._listCommand,
    this._helpCommand,
    this._versionCommand,
    this._filterCommand
    // this._generateWrapperFilesCommand
  ]

  constructor() { }

  /**
   * Get an instance with singletonManager.ts and then run this method to start the CLI.
   */
  async runMainAsync() {
    try {
      await this.main()
      this.okExit()
    } catch (err) {
      console.error(err)
      this.failureExit('An unexpected error occurred')
    }
  }

  /**
   * Don't call directly - see exports in src/index.ts. Also see {@link TaskOrNamedTask} for more info.
   */
  series(first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task {
    const innerSeries = async () => {
      for (const task of [first, ...rest]) {
        await this.runTask(this.getLogNameAndTask(task))
      }
    }
    return innerSeries
  }

  /**
   * Don't call directly - see exports in src/index.ts. Also see {@link TaskOrNamedTask} for more info.
   */
  parallel(...tasks: TaskOrNamedTask[]): Task {
    const parallelInner = async () => {
      const promises: Promise<void>[] = tasks.map(task => {
        return this.runTask(this.getLogNameAndTask(task))
      })
      const results = await Promise.allSettled(promises)
      const rejected = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]
      if (rejected.length > 0) {
        const errors = rejected.map((result) => result.reason)
        throw errors
      }
    }
    return parallelInner
  }

  private async runTask(logNameAndTask: LogNameAndTask) {
    const startTimestamp = Date.now()
    this.logFormattedStartMessage(logNameAndTask.logName, startTimestamp)
    await logNameAndTask.task()
    const endTimestamp = Date.now()
    const duration = endTimestamp - startTimestamp
    this.logFormattedEndMessage(logNameAndTask.logName, endTimestamp, duration)
  }

  private getLogNameAndTask(taskOrNamedTask: TaskOrNamedTask): LogNameAndTask {
    if (Array.isArray(taskOrNamedTask)) {
      return { logName: taskOrNamedTask[0], task: taskOrNamedTask[1] }
    } else {
      let name = taskOrNamedTask.name
      if (name === 'seriesInner') {
        name = `nested_${name}_${this._seriesCounter.toString()}`.replace('Inner', '')
        this._seriesCounter++
      } else if (name === 'parallelInner') {
        name = `nested_${name}_${this._parallelCounter.toString()}`.replace('Inner', '')
        this._parallelCounter++
      } else if (!name) {
        name = 'anonymous'
      }
      return { logName: name, task: taskOrNamedTask }
    }
  }

  private getTimestampPrefix(date: Date) {
    return `[${this.gray(date.toLocaleTimeString('en-US', { hour12: true }))}]`
  }

  private logFormattedStartMessage(taskName: string, startTimestamp: number) {
    const prefix = `${this.getTimestampPrefix(new Date(startTimestamp))} `
    log(`${prefix}Starting 🚀 ${this.cyan(taskName)}`)
  }

  private logFormattedEndMessage(taskName: string, endTimestamp: number, duration: number) {
    const prefix = `${this.getTimestampPrefix(new Date(endTimestamp))} `
    log(`${prefix}Finished ✅ ${this.cyan(taskName)} after ${this.purple(this.formatElapsedDuration(duration))}`)
  }

  private formatElapsedDuration(elapsedMs: number) {
    if (elapsedMs < 1000) {
      return `${elapsedMs} ms`
    } else {
      return `${(elapsedMs / 1000).toFixed(2)} seconds`
    }
  }

  colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[96m',
    gray: '\x1b[90m',
    purple: '\x1b[35m'
  }

  red(str: string) {
    return this.color(str, this.colors.red)
  }

  green(str: string) {
    return this.color(str, this.colors.green)
  }

  cyan(str: string) {
    return this.color(str, this.colors.cyan)
  }

  gray(str: string) {
    return this.color(str, this.colors.gray)
  }

  purple(str: string) {
    return this.color(str, this.colors.purple)
  }

  color(str: string, colorAnsiCode: string) {
    return `${colorAnsiCode}${str}${this.colors.reset}`
  }

  private getTaskFilePath(): URL | string | null {
    for (const filename of this._possibleTaskFileNames) {
      const filePath = path.resolve(this._cwd, filename)
      if (fs.existsSync(filePath)) {
        if (this.isEsm) {
          return pathToFileURL(filePath)
        }
        return filePath
      }
    }
    return null
  }

  private getStartMessage(taskFilePath: string, cliParam: CliParam): string {
    const commandOrTaskMessage = cliParam.isCommand ? 'Command' : 'Task'
    const helpMessage = `${this.gray('use ')}swig help ${this.gray('for more info')}`
    const taskFilename = taskFilePath ? path.basename(taskFilePath) : ''
    const modeMessage = `[ Mode: ${this.cyan(this.isEsm ? 'ESM' : 'CommonJS')} ]` // This may be useful in the future
    const versionMessage = `Version: ${this.cyan(this._versionString)}`
    return `[ ${commandOrTaskMessage}: ${this.cyan(cliParam.value)} ][ Swigfile: ${this.cyan(taskFilename)} ][ ${versionMessage} ]${showMode ? modeMessage : ''} ${helpMessage}`
  }

  private getFinishedMessage(mainStartTime: number, hasErrors?: boolean): string {
    const totalDuration = Date.now() - mainStartTime
    const statusMessage = `Result: ${hasErrors ? this.red('failed') : this.green('success')}`
    const durationMessage = `Total duration: ${this.color(this.formatElapsedDuration(totalDuration), hasErrors ? this.colors.yellow : this.colors.green)}`
    return `[ ${statusMessage} ][ ${durationMessage} ]`
  }

  private getCliParam(): CliParam {
    const cliArg = process.argv[2]

    if (!cliArg) {
      return new CliParam(this._listCommand.id, true)
    }

    const commandDescriptor = this._commandDescriptors.find(d => d.names.includes(cliArg.toLowerCase()) || d.alternateNames.includes(cliArg.toLowerCase()))
    if (commandDescriptor) {
      return new CliParam(commandDescriptor.id, true)
    }

    const argWithInvalidFunctionCharsStripped = cliArg.replace(/[^a-zA-Z0-9_]/g, '')
    if (argWithInvalidFunctionCharsStripped !== cliArg) {
      this.failureExit(`Invalid task name: ${cliArg}`)
    }

    return new CliParam(cliArg, false)
  }

  private isFunction(task: unknown): boolean {
    return !!task && typeof task === 'function'
  }

  private showTaskList(tasks: TasksMap, mainStartTime: number, filter?: string) {
    const taskNames = tasks.map(([name, _]) => name)
    log(`Available tasks:`)
    for (const taskName of taskNames) {
      const taskFn = tasks.find(([name, _]) => name === taskName)?.[1]
      if (typeof taskFn === 'function') {
        if (filter && !taskName.toLowerCase().includes(filter.toLowerCase())) {
          continue
        }
        log(`  ${this.cyan(taskName)}`)
      }
    }
    log(this.getFinishedMessage(mainStartTime))
    return this.okExit()
  }

  private showHelpMessage() {
    log(`Usage: swig <command> [options]`)
    log(`Commands:`)
    for (const commandDescriptor of this._commandDescriptors) {
      log(`  ${commandDescriptor.names.join(', ')} ${this.gray(commandDescriptor.description)}`)
      log(`    ${this.gray(commandDescriptor.example)}`)
    }
    return this.okExit()
  }

  private showVersionMessage() {
    log(this._versionString)
    return this.okExit()
  }

  private getFuncByTaskName(tasks: TasksMap, taskName: string) {
    return tasks.find(([name, _]) => name === taskName)?.[1]
  }

  private generateWrapperFiles() {
    const batFilename = 'swig.bat'
    const shFilename = 'swig'
    const helpMessage = `Run this script with 'help' param for more info`
    const isTsNode = process.argv[3] === 'ts-node'

    const bat = `@echo off\nREM ${helpMessage}\nnode ./node_modules/swig-cli/dist/esm/swigCli.js %*`
    const sh = `#!/bin/bash\n# ${helpMessage}\nnode ./node_modules/swig-cli/dist/esm/swigCli.js $@`

    const tsNodeBat = `@echo off\nREM ${helpMessage}\nnode ./node_modules/.bin/ts-node -T ./node_modules/swig-cli/dist/cjs/swigCli.cjs %*`
    const tsNodeSh = `#!/bin/bash\n# ${helpMessage}\nnode ./node_modules/.bin/ts-node -T ./node_modules/swig-cli/dist/cjs/swigCli.cjs $@`

    const batPath = path.resolve(this._cwd, batFilename)
    const shPath = path.resolve(this._cwd, shFilename)

    fs.writeFileSync(batPath, isTsNode ? tsNodeBat : bat, { encoding: 'utf8' })
    fs.writeFileSync(shPath, isTsNode ? tsNodeSh : sh, { encoding: 'utf8' })

    const additionalTsMessage = isTsNode ? ' pointing to ts-node' : ''
    log(`Generated wrapper files ${this.cyan(shFilename)} and ${this.cyan(batFilename)}${additionalTsMessage}`)
    log(`Don't forget to run '${this.cyan('chmod +x swig')}' to make swig executable if you are on Linux or Mac`)

    return this.okExit()
  }

  private async main() {
    const mainStartTime = Date.now()

    const cliParam: CliParam = this.getCliParam()

    const taskFilePathOrUrl: string | URL | null = this.getTaskFilePath() // string or URL to support both ESM and CJS

    if (cliParam.value === this._versionCommand.id) {
      return this.showVersionMessage()
    }

    log(this.getStartMessage(taskFilePathOrUrl ? taskFilePathOrUrl.toString() : '', cliParam))

    if (cliParam.value === this._helpCommand.id) {
      return this.showHelpMessage()
    }

    if (cliParam.matches(this._generateWrapperFilesCommand)) {
      return this.generateWrapperFiles()
    }

    if (!taskFilePathOrUrl) {
      return this.failureExit(`Task file not found - must be one of the following: ${this._possibleTaskFileNames.join(', ')}`)
    }

    let module: object
    let tasks: TasksMap
    try {
      module = await import(taskFilePathOrUrl.toString())
      tasks = Object.entries(module).filter(([_, value]) => this.isFunction(value))
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Cannot find module') || err.message.includes('Cannot find package')) {
          return this.failureExit(`Error importing swig-cli from within ${this.cyan(path.basename(taskFilePathOrUrl.toString()))}\nMake sure you have installed the dependency swig-cli in your project: npm i -D swig-cli`)
        } else {
          console.error(err.message)
        }
      } else {
        console.error(err)
      }
      return this.failureExit(`Could not import task file ${taskFilePathOrUrl}`)
    }

    if (cliParam.matches(this._listCommand)) {
      return this.showTaskList(tasks, mainStartTime)
    }
    if (cliParam.matches(this._filterCommand)) {
      const filter = process.argv[3]
      return this.showTaskList(tasks, mainStartTime, filter)
    }

    const rootFunc = this.getFuncByTaskName(tasks, cliParam.value)
    if (!rootFunc) {
      return this.failureExit(`Task '${cliParam.value}' not found. Tasks must be exported functions in your swigfile. Try 'swig list' to see available tasks.`)
    }

    let hasErrors = false
    try {
      await rootFunc()
    } catch (rawErr: unknown) {
      hasErrors = true
      let label = 'Error'
      let err = rawErr
      if (Array.isArray(err)) {
        if (err.length === 1) {
          err = err[0]
        } else if (err.length > 1) {
          label = `Errors (${err.length})`
        }
      }
      log(this.red(label))
      console.error(err)
    } finally {
      log(this.getFinishedMessage(mainStartTime, hasErrors))
      if (hasErrors) {
        this.failureExit()
      }
    }
  }

  private failureExit(message?: string) {
    if (message) { console.error(`${this.red('Error:')} ${message}`) }
    process.exit(1)
  }

  private okExit() {
    process.exit(0)
  }
}
