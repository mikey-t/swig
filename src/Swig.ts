import fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Task, TaskOrNamedTask, isNamedTask } from './index.js'
import { AnsiColor, color, cyan, gray, green, isFunction, log, purple, red, yellow } from './utils.js'

const showModeInStartMessage = false
const showHelpInStartMessage = false

interface LogNameAndTask { logName: string, task: Task }

interface CommandDescriptor { id: string, names: string[], alternateNames: string[], description: string, example: string }

type TasksMap = [string, (() => void | Promise<void>)][]

export const possibleTaskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']

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
  private versionString: string = '__VERSION__' // This is replaced in the build script
  private cwd = process.cwd()
  private seriesCounter = 1
  private parallelCounter = 1
  private listCommand = { id: 'list', names: ['list', 'ls', 'l'], alternateNames: ['-l', '--list'], description: 'List available tasks (default)', example: 'swig list' }
  private helpCommand = { id: 'help', names: ['help', 'h'], alternateNames: ['-h', '--help'], description: 'Show help message', example: 'swig help' }
  private versionCommand = { id: 'version', names: ['version', 'v'], alternateNames: ['-v', '--version'], description: 'Print version number', example: 'swig version' }
  private filterCommand = { id: 'filter', names: ['filter', 'f'], alternateNames: ['-f', '--filter'], description: 'Filter and list tasks by name', example: 'swig filter pattern' }
  private commandDescriptors: CommandDescriptor[] = [
    { id: 'task', names: ['<taskName>'], alternateNames: [], description: 'Run a "task", which is an async function exported from your swigfile', example: 'swig taskName' },
    this.listCommand,
    this.helpCommand,
    this.versionCommand,
    this.filterCommand
  ]

  constructor() { }

  // Get an instance with singletonManager.ts and then run this method to start the CLI.
  async runMainAsync() {
    try {
      await this.main()
      this.okExit()
    } catch (err) {
      console.error(err)
      this.failureExit('An unexpected error occurred')
    }
  }

  // Don't call this directly - see module exports in src/index.ts. Also see TaskOrNamedTask for more info.
  series = (first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task => {
    const innerSeries = async () => {
      for (const task of [first, ...rest]) {
        await this.runTask(this.getLogNameAndTask(task))
      }
    }
    return innerSeries
  }

  // Don't call this directly - see module exports in src/index.ts. Also see TaskOrNamedTask for more info.
  parallel = (...tasks: TaskOrNamedTask[]): Task => {
    const innerParallel = async () => {
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
    return innerParallel
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
    this.throwIfNotTaskOrNamedTask(taskOrNamedTask)

    if (isNamedTask(taskOrNamedTask)) {
      return { logName: taskOrNamedTask[0], task: taskOrNamedTask[1] }
    }

    let name = taskOrNamedTask.name

    if (name === 'innerSeries') {
      name = `nested_series_${this.seriesCounter.toString()}`
      this.seriesCounter++
    } else if (name === 'innerParallel') {
      name = `nested_parallel_${this.parallelCounter.toString()}`
      this.parallelCounter++
    } else if (!name) {
      name = 'anonymous'
    }

    return { logName: name, task: taskOrNamedTask }
  }

  private throwIfNotTaskOrNamedTask(taskOrNamedTask: TaskOrNamedTask) {
    if (!isNamedTask(taskOrNamedTask) && !isFunction(taskOrNamedTask)) {
      throw new Error(`A param passed to "series" or "parallel" was not a Task (function) or a NamedTask ([string,function] tuple): ${taskOrNamedTask}`)
    }
  }

  private getTimestampPrefix(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
    return gray(`[${hours}:${minutes}:${seconds}.${milliseconds}]`)
  }

  private logFormattedStartMessage(taskName: string, startTimestamp: number) {
    const prefix = `${this.getTimestampPrefix(new Date(startTimestamp))} `
    log(`${prefix}Starting 🚀 ${cyan(taskName)}`)
  }

  private logFormattedEndMessage(taskName: string, endTimestamp: number, duration: number) {
    const prefix = `${this.getTimestampPrefix(new Date(endTimestamp))} `
    log(`${prefix}Finished ✅ ${cyan(taskName)} after ${purple(this.humanizeTime(duration))}`)
  }

  private humanizeTime(milliseconds: number): string {
    let value: number
    let unit: string

    if (milliseconds < 1000) {
      return `${milliseconds} ms`
    }

    if (milliseconds < 60000) {
      value = milliseconds / 1000
      unit = 'second'
    } else if (milliseconds < 3600000) {
      value = milliseconds / 60000
      unit = 'minute'
    } else {
      value = milliseconds / 3600000
      unit = 'hour'
    }

    let stringValue = value.toFixed(2)

    if (stringValue.endsWith('.00')) {
      stringValue = stringValue.slice(0, -3)
    } else if (stringValue.endsWith('0')) {
      stringValue = stringValue.slice(0, -1)
    }

    if (stringValue !== '1') {
      unit += 's'
    }

    return `${stringValue} ${unit}`
  }

  private getTaskFilePath(): URL | string | null {
    for (const filename of possibleTaskFileNames) {
      const filePath = path.resolve(this.cwd, filename)
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
    const helpMessage = `[ ${gray('use ')}swig help ${gray('for more info')} ]`
    const taskFilename = taskFilePath ? path.basename(taskFilePath) : ''
    const modeMessage = `[ Mode: ${cyan(this.isEsm ? 'ESM' : 'CommonJS')} ]`
    const versionMessage = `Version: ${cyan(this.versionString)}`
    return `[ ${commandOrTaskMessage}: ${cyan(cliParam.value)} ][ Swigfile: ${cyan(taskFilename)} ][ ${versionMessage} ]${showModeInStartMessage ? modeMessage : ''}${showHelpInStartMessage ? helpMessage : ''}`
  }

  private getFinishedMessage(mainStartTime: number, hasErrors?: boolean): string {
    const totalDuration = Date.now() - mainStartTime
    const statusMessage = `Result: ${hasErrors ? red('failed') : green('success')}`
    const durationMessage = `Total duration: ${color(this.humanizeTime(totalDuration), hasErrors ? AnsiColor.YELLOW : AnsiColor.GREEN)}`
    return `[ ${statusMessage} ][ ${durationMessage} ]`
  }

  private getCliParam(): CliParam {
    const cliArg = process.argv[2]

    if (!cliArg) {
      return new CliParam(this.listCommand.id, true)
    }

    const commandDescriptor = this.commandDescriptors.find(d => d.names.includes(cliArg.toLowerCase()) || d.alternateNames.includes(cliArg.toLowerCase()))
    if (commandDescriptor) {
      return new CliParam(commandDescriptor.id, true)
    }

    const argWithInvalidFunctionCharsStripped = cliArg.replace(/[^a-zA-Z0-9_]/g, '')
    if (argWithInvalidFunctionCharsStripped !== cliArg) {
      this.failureExit(`Invalid task name: ${cliArg}`)
    }

    return new CliParam(cliArg, false)
  }

  private showTaskList(tasks: TasksMap, mainStartTime: number, filter?: string) {
    const taskNames = tasks.map(([name,]) => name)
    log(`Available tasks:`)
    for (const taskName of taskNames) {
      if (filter && !taskName.toLowerCase().includes(filter.toLowerCase())) {
        continue
      }
      log(`  ${cyan(taskName)}`)
    }
    log(this.getFinishedMessage(mainStartTime))
    return this.okExit()
  }

  private showHelpMessage() {
    log(`Usage: swig <command or taskName> [options]`)
    log(`Commands:`)
    for (const commandDescriptor of this.commandDescriptors) {
      log(`  ${commandDescriptor.names.join(', ')}${gray(` - ${commandDescriptor.description}`)}`)
      log(`    ${gray(commandDescriptor.example)}`)
    }
    log(`Initialize or update a swig project: npx swig-cli-init@latest`)
    return this.okExit()
  }

  private showVersionMessage() {
    log(this.versionString)
    return this.okExit()
  }

  private getFuncByTaskName(tasks: TasksMap, taskName: string) {
    return tasks.find(([name,]) => name === taskName)?.[1]
  }

  private async main() {
    const mainStartTime = Date.now()

    const cliParam: CliParam = this.getCliParam()

    const taskFilePathOrUrl: string | URL | null = this.getTaskFilePath() // string or URL to support both ESM and CJS

    if (cliParam.value === this.versionCommand.id) {
      return this.showVersionMessage()
    }

    log(this.getStartMessage(taskFilePathOrUrl ? taskFilePathOrUrl.toString() : '', cliParam))

    if (cliParam.value === this.helpCommand.id) {
      return this.showHelpMessage()
    }

    if (!taskFilePathOrUrl) {
      return this.failureExit(`Task file not found - must be one of the following: ${possibleTaskFileNames.join(', ')}`)
    }

    let module: object
    let tasks: TasksMap
    const swigfilePath = taskFilePathOrUrl.toString()
    try {
      module = await import(swigfilePath)
      tasks = Object.entries(module).filter(([, value]) => isFunction(value))
    } catch (err) {
      if (swigfilePath && swigfilePath.endsWith('.ts') && err instanceof Error && err.message.includes('exports is not defined')) {
        console.log(`${yellow('Suggestion:')} try adjusting your tsconfig.json compilerOptions (especially the "module" setting)`)
      }
      console.error(err)
      return this.failureExit(`Could not import task file ${swigfilePath}`)
    }

    if (cliParam.matches(this.listCommand)) {
      return this.showTaskList(tasks, mainStartTime)
    }
    if (cliParam.matches(this.filterCommand)) {
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
      log(red(label))
      console.error(err)
    } finally {
      log(this.getFinishedMessage(mainStartTime, hasErrors))
      if (hasErrors) {
        this.failureExit()
      }
    }
  }

  private failureExit(message?: string) {
    if (message) { console.error(`${red('Error:')} ${message}`) }
    process.exit(1)
  }

  private okExit() {
    process.exit(0)
  }
}
