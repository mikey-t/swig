#!/usr/bin/env node

import * as path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'node:url'

const isEsm = typeof __filename === 'undefined'
console.log(`Running swig in ${isEsm ? 'ESM' : 'CommonJS'} mode`)

const scriptStartTime = Date.now()
const cwd = process.cwd()
const taskFileNames = ['swigfile.cjs', 'swigfile.mjs', 'swigfile.js', 'swigfile.ts']
const helpMessage = `No task provided. Use the 'list' command to see available tasks or check your swigfile exports.`

/**
 * Tasks can be one of the following:
 *   - Any function that is async or returns a Promise can be used as a task and passed to series() or parallel().
 *   - An array of [name, Task] can be used to provide a name for anonymous async functions that match the above description.
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
    console.log(`${prefix}Starting ${colors.lightCyan}${taskName}${colors.reset} ...`)
  }
  if (Array.isArray(task)) {
    await task[1]()
  } else {
    await task()
  }
  const endTimestamp = Date.now()
  const duration = endTimestamp - startTimestamp
  console.log(`${prefix}Finished ${colors.lightCyan}${taskName}${colors.reset} after ${colors.purple}${formatElapsedDuration(duration)}${colors.reset}`)
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
  lightCyan: '\x1b[96m',
  gray: '\x1b[90m',
  purple: '\x1b[35m'
}

function getTimestampPrefix(date: Date) {
  return `[${colors.gray}${date.toLocaleTimeString('en-US', { hour12: true })}${colors.reset}]`
}

function getFormattedStartMessage(taskName: string, startTimestamp: number) {
  const prefix = `${getTimestampPrefix(new Date(startTimestamp))} `
  return `${prefix}Starting ${colors.lightCyan}${taskName}${colors.reset} ...`
}

function getFormattedEndMessage(taskName: string, endTimestamp: number, duration: number) {
  const prefix = `${getTimestampPrefix(new Date(endTimestamp))} `
  console.log(`${prefix}Finished ${colors.lightCyan}${taskName}${colors.reset} after ${colors.purple}${formatElapsedDuration(duration)}${colors.reset}`)
}

function formatElapsedDuration(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${elapsedMs} ms`
  } else {
    return `${(elapsedMs / 1000).toFixed(2)} seconds`
  }
}

function failureExit(message?: string) {
  if (message) {
    console.error(`${colors.red}Error: ${colors.reset}${message}`)
  }
  process.exit(1)
}

function isListCommand(command: string) {
  return command === 'list' || command === 'ls' || command === 'l' || command === '--list' || command === '-l'
}

function showTaskList(tasks: any) {
  const taskNames = Object.keys(tasks)
  console.log(`Available tasks:`)
  for (const taskName of taskNames) {
    const taskFn = tasks[taskName]
    if (typeof taskFn === 'function') {
      console.log(`  ${colors.lightCyan}${taskName}${colors.reset}`)
    }
  }
}

function printFinishedMessage(divider: string, hasErrors: boolean) {
  const totalDuration = Date.now() - scriptStartTime
  console.log(divider)
  console.log(`Result: ${hasErrors ? colors.red + 'failed' : colors.green + 'success'}${colors.reset}`)
  console.log(`Total duration: ${hasErrors ? colors.yellow : colors.green}${formatElapsedDuration(totalDuration)}${colors.reset}`)
}

function getTaskFilePath(): URL | string | null {
  for (const filename of taskFileNames) {
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

async function main() {
  if (process.argv.length < 3) {
    return failureExit(helpMessage)
  }
  let taskName = process.argv[2]

  if (!taskName) {
    return failureExit(helpMessage)
  } else {
    console.log(`Running task '${taskName}'\n`)
  }

  const taskFile = getTaskFilePath()

  if (!taskFile) {
    return failureExit(`Task file not found (${taskFileNames.join(' or ')})`)
  }

  if (isListCommand(taskName)) {
    taskName = 'list'
  }

  const swigFileMessage = `Swig: ${colors.purple}${taskFile}${colors.reset}`
  const swigFileMessageLength = swigFileMessage.length - colors.purple.length - colors.reset.length
  const taskMessage = `Task: ${colors.lightCyan}${taskName}${colors.reset}`
  const taskMessageLength = taskMessage.length - colors.lightCyan.length - colors.reset.length
  const divider = '-'.repeat(Math.max(swigFileMessageLength, taskMessageLength))
  console.log(swigFileMessage)
  console.log(taskMessage)
  console.log(divider)

  let tasks: any
  try {
    tasks = await import(taskFile.toString())
  } catch (err) {
    console.error(err)
    failureExit(`Could not import task file ${taskFile}`)
    return
  }

  if (isListCommand(taskName)) {
    showTaskList(tasks)
    printFinishedMessage(divider, false)
    process.exit(0)
  }

  if (!tasks || typeof tasks[taskName] !== 'function') {
    failureExit(`Task '${taskName}' not found. Tasks must be exported functions in your swigfile.`)
    return
  }

  let hasErrors = false
  try {
    await tasks[taskName]()
  } catch (err: any) {
    let label = 'Error'
    const isArrayOfErrors = Array.isArray(err)
    if (isArrayOfErrors && err.length === 1) {
      err = err[0]
    } else if (isArrayOfErrors && err.length > 1) {
      label = `Errors (${err.length})`
    }
    console.log(`${colors.red}${label}${colors.reset}:`)
    console.error(err)
    hasErrors = true
  } finally {
    printFinishedMessage(divider, hasErrors)
    if (hasErrors) {
      failureExit()
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    failureExit('An unexpected error occurred')
  })
