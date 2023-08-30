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
interface CommandDescriptor { names: string[], description: string, example: string }
interface CliParam { value: string, isCommand: boolean }
type TasksMap = [string, (() => void | Promise<void>)][]

export default class Swig {
  isCommonJS = typeof require === "function" && typeof module === "object" && module.exports
  isEsm = !this.isCommonJS
  private _versionString: string = '__VERSION__' // Set in build script in transpiled version of file
  private _cwd = process.cwd()
  private _seriesCounter = 1
  private _parallelCounter = 1
  private _possibleTaskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']
  private _commandDescriptors: CommandDescriptor[] = [
    { names: ['<taskName>'], description: 'Run a task, whish is an async function exported from your swigfile that returns a Task', example: 'swig functionName' },
    { names: ['list', 'ls', 'l'], description: 'List available tasks (default)', example: 'swig list' },
    { names: ['help', 'h'], description: 'Show help message', example: 'swig help' },
    { names: ['version', 'v'], description: 'Print version number', example: 'swig version' },
    { names: ['filter', 'f'], description: 'Filter and list tasks by name', example: 'swig filter pattern' },
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
    const taskFilename = path.basename(taskFilePath)
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
      return { value: 'list', isCommand: true }
    }

    const commandDescriptor = this._commandDescriptors.find(d => d.names.includes(cliArg.toLowerCase()))
    if (commandDescriptor) {
      return { value: commandDescriptor.names[0], isCommand: true }
    }

    if (this.isCliArgAlternateVersion(cliArg)) {
      return { value: 'version', isCommand: true }
    }

    // Ensure it only has characters that are valid for a function name
    const cleaned = cliArg.replace(/[^a-zA-Z0-9_]/g, '')
    if (cleaned !== cliArg) {
      this.failureExit(`Invalid task name: ${cliArg}`)
    }

    return { value: cliArg, isCommand: false }
  }

  private isCliArgAlternateVersion(cliArg: string): boolean {
    return ['-v', '--version', '-version'].includes(cliArg.toLowerCase())
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

  private getFunc(tasks: TasksMap, taskName: string) {
    return tasks.find(([name, _]) => name === taskName)?.[1]
  }

  private async main() {
    const mainStartTime = Date.now()

    const cliParam: CliParam = this.getCliParam()

    const taskFilePathOrUrl: string | URL | null = this.getTaskFilePath() // string or URL to support both ESM and CJS

    if (!taskFilePathOrUrl) {
      return this.failureExit(`Task file not found - must be one of the following: ${this._possibleTaskFileNames.join(', ')}`)
    }

    if (cliParam.value !== 'version') {
      log(this.getStartMessage(taskFilePathOrUrl.toString(), cliParam))
    }

    let module: object
    let tasks: TasksMap
    try {
      module = await import(taskFilePathOrUrl.toString())
      tasks = Object.entries(module).filter(([_, value]) => this.isFunction(value))
    } catch (err) {
      console.error(err)
      return this.failureExit(`Could not import task file ${taskFilePathOrUrl}`)
    }

    if (cliParam.value === 'list') {
      return this.showTaskList(tasks, mainStartTime)
    }
    if (cliParam.value === 'help') {
      return this.showHelpMessage()
    }
    if (cliParam.value === 'version') {
      return this.showVersionMessage()
    }
    if (cliParam.value === 'filter') {
      const filter = process.argv[3]
      return this.showTaskList(tasks, mainStartTime, filter)
    }

    const rootFunc = this.getFunc(tasks, cliParam.value)
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
