#!/usr/bin/env node

import * as path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'node:url'

const isCommonJS = typeof require === "function" && typeof module === "object" && module.exports
const isEsm = !isCommonJS
let getFilename: () => string
if (isEsm) {
  import('./esmSpecific.mjs').then(esmSpecific => {
    getFilename = esmSpecific.getFilename
  })
} else {
  getFilename = () => __filename
}
let _filename: string
let _dirname: string

/**
 * Tasks can be one of the following:
 *   - Any function that is async or returns a Promise.
 *   - An array/tuple of [name, Task] can be used to provide a label for anonymous functions.
 * 
 * Example, including tuple use: series(['task1', async () => { ... }], task2, task3)
 */
export type Task = () => Promise<unknown>
export type NamedTask = [string, Task]
export type TaskOrNamedTask = Task | NamedTask
interface LogNameAndTask { logName: string, task: Task }
interface CommandDescriptor { names: string[], description: string, example: string }
interface CliParam { value: string, isCommand: boolean }
type TasksMap = [string, (() => void | Promise<void>)][]

const scriptStartTime = Date.now()
const cwd = process.cwd()
const possibleTaskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']
const commandDescriptors: CommandDescriptor[] = [
  { names: ['<taskName>'], description: 'Run a task', example: 'swig taskName' },
  { names: ['list', 'ls', 'l'], description: 'List available tasks (default)', example: 'swig list' },
  { names: ['help', 'h'], description: 'Show help message', example: 'swig help' },
  { names: ['version', 'v'], description: 'Show version number', example: 'swig version' },
  { names: ['filter', 'f'], description: 'Filter and list tasks by name', example: 'swig filter pattern' },
]
let seriesCounter = 1
let parallelCounter = 1

export function series(first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task {
  return async function seriesInner() {
    for (const task of [first, ...rest]) {
      await runTask(getLogNameAndTask(task))
    }
  }
}

export function parallel(...tasks: TaskOrNamedTask[]): Task {
  return async function parallelInner() {
    const promises: Promise<void>[] = tasks.map(task => {
      return runTask(getLogNameAndTask(task))
    })
    const results = await Promise.allSettled(promises)
    const rejected = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]
    if (rejected.length > 0) {
      const errors = rejected.map((result) => result.reason)
      throw errors
    }
  }
}

async function runTask(logNameAndTask: LogNameAndTask) {
  const startTimestamp = Date.now()
  logFormattedStartMessage(logNameAndTask.logName, startTimestamp)
  await logNameAndTask.task()
  const endTimestamp = Date.now()
  const duration = endTimestamp - startTimestamp
  logFormattedEndMessage(logNameAndTask.logName, endTimestamp, duration)
}

function getLogNameAndTask(taskOrNamedTask: TaskOrNamedTask): LogNameAndTask {
  if (Array.isArray(taskOrNamedTask)) {
    return { logName: taskOrNamedTask[0], task: taskOrNamedTask[1] }
  } else {
    let name = taskOrNamedTask.name
    if (name === 'seriesInner') {
      name = `nested_${name}_${seriesCounter.toString()}`.replace('Inner', '')
      seriesCounter++
    } else if (name === 'parallelInner') {
      name = `nested_${name}_${parallelCounter.toString()}`.replace('Inner', '')
      parallelCounter++
    } else if (!name) {
      name = 'anonymous'
    }
    return { logName: name, task: taskOrNamedTask }
  }
}

function getTimestampPrefix(date: Date) {
  return `[${gray(date.toLocaleTimeString('en-US', { hour12: true }))}]`
}

function logFormattedStartMessage(taskName: string, startTimestamp: number) {
  const prefix = `${getTimestampPrefix(new Date(startTimestamp))} `
  log(`${prefix}Starting 🚀 ${cyan(taskName)}`)
}

function logFormattedEndMessage(taskName: string, endTimestamp: number, duration: number) {
  const prefix = `${getTimestampPrefix(new Date(endTimestamp))} `
  log(`${prefix}Finished ✅ ${cyan(taskName)} after ${purple(formatElapsedDuration(duration))}`)
}

function formatElapsedDuration(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${elapsedMs} ms`
  } else {
    return `${(elapsedMs / 1000).toFixed(2)} seconds`
  }
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[96m',
  gray: '\x1b[90m',
  purple: '\x1b[35m'
}

function red(str: string) {
  return color(str, colors.red)
}

function green(str: string) {
  return color(str, colors.green)
}

function cyan(str: string) {
  return color(str, colors.cyan)
}

function gray(str: string) {
  return color(str, colors.gray)
}

function purple(str: string) {
  return color(str, colors.purple)
}

function color(str: string, colorAnsiCode: string) {
  return `${colorAnsiCode}${str}${colors.reset}`
}

function getTaskFilePath(): URL | string | null {
  for (const filename of possibleTaskFileNames) {
    const filePath = path.resolve(cwd, filename)
    if (fs.existsSync(filePath)) {
      if (isEsm) {
        return pathToFileURL(filePath)
      }
      return filePath
    }
  }
  return null
}

function getStartMessage(taskFilePath: string, cliParam: CliParam): string {
  const commandOrTaskMessage = cliParam.isCommand ? 'Command' : 'Task'
  const helpMessage = `${gray('use ')}swig help ${gray('for more info')}`
  const taskFilename = path.basename(taskFilePath)
  const modeMessage = `Mode: ${cyan(isEsm ? 'ESM' : 'CommonJS')}`
  return `[ ${commandOrTaskMessage}: ${cyan(cliParam.value)} ][ Swigfile: ${cyan(taskFilename)} ][ ${modeMessage} ] ${helpMessage}`
}

function getFinishedMessage(hasErrors?: boolean): string {
  const totalDuration = Date.now() - scriptStartTime
  const statusMessage = `Result: ${hasErrors ? red('failed') : green('success')}`
  const durationMessage = `Total duration: ${color(formatElapsedDuration(totalDuration), hasErrors ? colors.yellow : colors.green)}`
  return `[ ${statusMessage} ][ ${durationMessage} ]`
}

function getCliParam(): CliParam {
  const cliArg = process.argv[2]
  if (!cliArg) {
    return { value: 'list', isCommand: true }
  }
  const commandDescriptor = commandDescriptors.find(d => d.names.includes(cliArg.toLowerCase()))
  if (commandDescriptor) {
    return { value: commandDescriptor.names[0], isCommand: true }
  }

  // Ensure it only has characters that are valid for a function name
  const cleaned = cliArg.replace(/[^a-zA-Z0-9_]/g, '')
  if (cleaned !== cliArg) {
    failureExit(`Invalid task name: ${cliArg}`)
  }

  return { value: cliArg, isCommand: false }
}

function isFunction(task: unknown): boolean {
  return !!task && typeof task === 'function'
}

function log(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function trace(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

function showTaskList(tasks: TasksMap, filter?: string) {
  const taskNames = tasks.map(([name, _]) => name)
  log(`Available tasks:`)
  for (const taskName of taskNames) {
    const taskFn = tasks.find(([name, _]) => name === taskName)?.[1]
    if (typeof taskFn === 'function') {
      if (filter && !taskName.toLowerCase().includes(filter.toLowerCase())) {
        continue
      }
      log(`  ${cyan(taskName)}`)
    }
  }
  log(getFinishedMessage())
  return okExit()
}

function showHelpMessage() {
  log(`Usage: swig <command> [options]`)
  log(`Commands:`)
  for (const commandDescriptor of commandDescriptors) {
    log(`  ${commandDescriptor.names.join(', ')} ${gray(commandDescriptor.description)}`)
    log(`    ${gray(commandDescriptor.example)}`)
  }
  return okExit()
}

function showVersionMessage() {
  const packageJsonPath = path.resolve(_dirname, '../../package.json')
  if (!packageJsonPath) {
    return failureExit(`Could not find package.json to get version number`)
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  log(`${packageJson.version}`)
  return okExit()
}

function getFunc(tasks: TasksMap, taskName: string) {
  return tasks.find(([name, _]) => name === taskName)?.[1]
}

async function main() {
  const cliParam: CliParam = getCliParam()

  const taskFilePathOrUrl: string | URL | null = getTaskFilePath() // string or URL to support both ESM and CJS

  if (!taskFilePathOrUrl) {
    return failureExit(`Task file not found - must be one of the following: ${possibleTaskFileNames.join(', ')}`)
  }

  if (cliParam.value !== 'version') {
    log(getStartMessage(taskFilePathOrUrl.toString(), cliParam))
  }

  let module: object
  let tasks: TasksMap
  try {
    module = await import(taskFilePathOrUrl.toString())
    tasks = Object.entries(module).filter(([_, value]) => isFunction(value))
  } catch (err) {
    console.error(err)
    return failureExit(`Could not import task file ${taskFilePathOrUrl}`)
  }

  if (cliParam.value === 'list') {
    return showTaskList(tasks)
  }
  if (cliParam.value === 'help') {
    return showHelpMessage()
  }
  if (cliParam.value === 'version') {
    return showVersionMessage()
  }
  if (cliParam.value === 'filter') {
    const filter = process.argv[3]
    return showTaskList(tasks, filter)
  }

  const rootFunc = getFunc(tasks, cliParam.value)
  if (!rootFunc) {
    return failureExit(`Task '${cliParam.value}' not found. Tasks must be exported functions in your swigfile. Try 'swig list' to see available tasks.`)
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

    if (err instanceof Error) {
      console.error(err.message)
    } else {
      console.error(err)
    }
  } finally {
    log(getFinishedMessage(hasErrors))
    if (hasErrors) {
      failureExit()
    }
  }
}

function failureExit(message?: string) {
  if (message) { console.error(`${red('Error:')} ${message}`) }
  process.exit(1)
}

function okExit() {
  process.exit(0)
}

const runMain = async () => {
  try {
    await main()
    okExit()
  } catch (err) {
    console.error(err)
    failureExit('An unexpected error occurred')
  }
}

const loadEsmSpecific = async () => {
  if (isEsm) {
    const module = await import('./esmSpecific.mjs')
    getFilename = module.getFilename
  } else {
    getFilename = () => __filename
  }
  _filename = getFilename()
  _dirname = path.dirname(_filename)
}

if ((isCommonJS && require.main === module) || isEsm) {
  loadEsmSpecific().then(() => runMain())
}
