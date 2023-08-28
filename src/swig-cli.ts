#!/usr/bin/env node

import * as path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'node:url'

const isEsm = typeof __filename === 'undefined'
const scriptStartTime = Date.now()
const cwd = process.cwd()
const possibleTaskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']
const helpMessage = `No task provided. Use the 'list' command to see available exported tasks from your swigfile.`

/**
 * Tasks can be one of the following:
 *   - Any function that is async or returns a Promise.
 *   - An array/tuple of [name, Task] can be used to provide a label for anonymous async functions.
 * 
 * Example using a tuple as one of the args: series(['task1', async () => { ... }], task2, task3)
 */
export type Task = (() => Promise<void>) | [string, () => Promise<void>]

export function series(first: Task, ...rest: Task[]): Task {
  return async () => {
    for (const task of [first, ...rest]) {
      if (Array.isArray(task)) {
        const [name, taskFn] = task
        await runTask(taskFn, name)
      } else {
        const taskFn = task
        await runTask(taskFn)
      }
    }
  }
}

export function parallel(...tasks: Task[]): Task {
  return async () => {
    const promises = tasks.map(task => runTask(task))
    const results = await Promise.allSettled(promises)
    const rejected = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]
    if (rejected.length > 0) {
      const errors = rejected.map((result) => result.reason)
      throw errors
    }
  }
}

async function runTask(task: Task, taskNameFromNamedTask?: string) {
  const startTimestamp = Date.now()
  const taskName = getTaskName(task, taskNameFromNamedTask)
  const prefix = `${getTimestampPrefix(new Date(startTimestamp))} `
  const shouldLog = !!taskName && taskName !== 'series' && taskName !== 'parallel'
  if (shouldLog) {
    log(`${prefix}Starting ${cyan(taskName)} ...`)
  }
  if (Array.isArray(task)) {
    await task[1]()
  } else {
    await task()
  }
  const endTimestamp = Date.now()
  const duration = endTimestamp - startTimestamp
  log(`${prefix}Finished ${cyan(taskName)} after ${purple(formatElapsedDuration(duration))}`)
}

function getTaskName(task: Task, taskNameFromNamedTask?: string) {
  if (Array.isArray(task)) {
    return task[0]
  } else {
    return task.name || 'anonymousFunction'
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

function yellow(str: string) {
  return color(str, colors.yellow)
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

function getTimestampPrefix(date: Date) {
  return `[${gray(date.toLocaleTimeString('en-US', { hour12: true }))}]`
}

function getFormattedStartMessage(taskName: string, startTimestamp: number) {
  const prefix = `${getTimestampPrefix(new Date(startTimestamp))} `
  return `${prefix}Starting ${cyan(taskName)} ...`
}

function getFormattedEndMessage(taskName: string, endTimestamp: number, duration: number) {
  const prefix = `${getTimestampPrefix(new Date(endTimestamp))} `
  log(`${prefix}Finished ${cyan(taskName)} after ${purple(formatElapsedDuration(duration))}`)
}

function formatElapsedDuration(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${elapsedMs} ms`
  } else {
    return `${(elapsedMs / 1000).toFixed(2)} seconds`
  }
}

function isListCommand(command: string) {
  return command === 'list' || command === 'ls' || command === 'l' || command === '--list' || command === '-l'
}

function showTaskList(tasks: any) {
  const taskNames = Object.keys(tasks)
  log(`Available tasks:`)
  for (const taskName of taskNames) {
    const taskFn = tasks[taskName]
    if (typeof taskFn === 'function') {
      log(`  ${cyan(taskName)}`)
    }
  }
}

function printFinishedMessage(divider: string, hasErrors: boolean) {
  const totalDuration = Date.now() - scriptStartTime
  log(divider)
  log(`Result: ${hasErrors ? red('failed') : green('success')}`)
  log(`Total duration: ${color(formatElapsedDuration(totalDuration), hasErrors ? colors.yellow : colors.green)}\n`)
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

function printStartMessageAndGetDivider(taskFilePath: string, cliParam: string): string {
  const moduleTypeMessage = `\n    Mode: ${cyan(isEsm ? 'ESM' : 'CommonJS')}`
  const swigFileMessage = `Swigfile: ${cyan(taskFilePath)}`
  const swigFileMessageLength = swigFileMessage.length - colors.cyan.length - colors.reset.length
  const taskMessage = `${cliParam === 'list' ? ' Command' : '    Task'}: ${cyan(cliParam)}`
  const taskMessageLength = taskMessage.length - colors.cyan.length - colors.reset.length
  const divider = '-'.repeat(Math.max(swigFileMessageLength, taskMessageLength))
  log(moduleTypeMessage)
  log(swigFileMessage)
  log(taskMessage)
  log(divider)
  return divider
}

function getCliParam(): string {
  if (process.argv.length < 3) { failureExit(helpMessage) }
  let command = process.argv[2]
  if (!command) { failureExit(helpMessage) }
  if (isListCommand(command)) { command = 'list' }
  return command
}

function isFunction(task: any): boolean {
  return !!task && typeof task === 'function'
}

function isSeriesOrParallel(task: Function) {
  log('task name: ' + task.name)
  log('typeof: ' + typeof task)
  log(task.name)
  log(Object.keys(task))
  return task.name === 'series' || task.name === 'parallel'
}

function log(message?: any, ...optionalParams: any[]) {
  console.log(message, ...optionalParams)
}

async function main() {
  const cliParam = getCliParam()
  const taskFilePathOrUrl: string | URL | null = getTaskFilePath() // string or URL to support both ESM and CJS
  if (!taskFilePathOrUrl) {
    return failureExit(`Task file not found - must be one of the following: ${possibleTaskFileNames.join(', ')}`)
  }
  const divider = printStartMessageAndGetDivider(taskFilePathOrUrl.toString(), cliParam)

  let tasks: any
  try {
    tasks = await import(taskFilePathOrUrl.toString())
  } catch (err) {
    console.error(err)
    return failureExit(`Could not import task file ${taskFilePathOrUrl}`)
  }

  if (isListCommand(cliParam)) {
    showTaskList(tasks)
    printFinishedMessage(divider, false)
    okExit()
  }

  const rootFunc = tasks[cliParam]
  if (!tasks || !isFunction(rootFunc)) {
    return failureExit(`Task '${cliParam}' not found. Tasks must be exported functions in your swigfile.`)
  }

  let hasErrors = false
  try {
    await rootFunc()
  } catch (err: any) {
    let label = 'Error'
    const isArrayOfErrors = Array.isArray(err)
    if (isArrayOfErrors && err.length === 1) {
      err = err[0]
    } else if (isArrayOfErrors && err.length > 1) {
      label = `Errors (${err.length})`
    }
    log(`${red(label)}:`)
    console.error(err)
    hasErrors = true
  } finally {
    printFinishedMessage(divider, hasErrors)
    if (hasErrors) {
      failureExit()
    }
  }
}

function failureExit(message?: string) {
  if (message) { console.error(`${red('Error: ')}${message}`) }
  process.exit(1)
}

function okExit() {
  process.exit(0)
}

main()
  .then(() => okExit())
  .catch(err => { console.error(err); failureExit('An unexpected error occurred') })
