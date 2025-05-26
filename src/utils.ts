import fs from 'node:fs'

export const traceEnabled = false

export function log(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trace(message?: unknown, ...optionalParams: unknown[]) {
  if (traceEnabled) {
    console.log(message, ...optionalParams)
  }
}

export enum AnsiColor {
  RESET = '\x1b[0m',
  RED = '\x1b[31m',
  GREEN = '\x1b[32m',
  YELLOW = '\x1b[33m',
  CYAN = '\x1b[96m',
  GRAY = '\x1b[90m',
  PURPLE = '\x1b[35m'
}

export const color = (str: string, colorAnsiCode: AnsiColor): string => {
  return `${colorAnsiCode}${str}${AnsiColor.RESET}`
}

export const red = (str: string) => color(str, AnsiColor.RED)
export const green = (str: string) => color(str, AnsiColor.GREEN)
export const cyan = (str: string) => color(str, AnsiColor.CYAN)
export const gray = (str: string) => color(str, AnsiColor.GRAY)
export const purple = (str: string) => color(str, AnsiColor.PURPLE)
export const yellow = (str: string) => color(str, AnsiColor.YELLOW)

interface SimpleVersion {
  raw: string
  major: number
  minor: number
  patch: number
}

export function getNodeVersion(): SimpleVersion | undefined {
  return parseVersionString(process.version)
}

export function parseVersionString(rawVersionString: string | undefined): SimpleVersion | undefined {
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

export function getTsxVersion(): SimpleVersion | undefined {
  try {
    const packageJsonPath = './node_modules/tsx/package.json'
    if (!fs.existsSync(packageJsonPath)) {
      return undefined
    }
    const packageJsonContents = fs.readFileSync(packageJsonPath, { encoding: 'utf-8' })
    const packageJson = JSON.parse(packageJsonContents)
    const versionString = packageJson.version
    return parseVersionString(versionString)
  } catch (err) {
    trace(`error getting tsx version`, err)
    return undefined
  }
}

export function isNodeLessThan18Dot19(nodeVersion: SimpleVersion): boolean {
  return nodeVersion.major < 18 || (nodeVersion.major === 18 && nodeVersion.minor < 19)
}

export function isNodeVersionIncompatibleWithTsx(nodeVersion: SimpleVersion): boolean {
  return nodeVersion.major === 18 && (nodeVersion.minor === 17 || nodeVersion.minor === 18)
}

export interface SpawnResult {
  code: number
  error?: Error
}

export function logTable(data: string[][]): void {
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

export const isFunction = (x: unknown): boolean => {
  if (typeof x !== 'function') {
    return false
  }
  const isClass = Object.getOwnPropertyDescriptor(x, 'prototype')?.writable === false
  return !isClass
}
