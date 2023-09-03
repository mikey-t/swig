import { SpawnOptions, spawn } from 'node:child_process'
import { existsSync, rmdirSync, mkdirSync, readdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs'

const traceEnabled = true
const TS_TS_NODE = 'swig-example-typescript-ts-node'
const TS_ESM = 'swig-example-typescript-esm'
const CJS = 'swig-example-commonjs'
const CJS_MJS = 'swig-example-commonjs-mjs'
const ESM = 'swig-example-esm'
const ESM_CJS = 'swig-example-esm-cjs'
const allExamples = [TS_TS_NODE, TS_ESM, CJS, CJS_MJS, ESM, ESM_CJS]
const primaryCodeFilenameEsm = 'Swig.js'
const primaryCodeFilenameCjs = 'Swig.cjs'
const cjsOutputDir = './dist/cjs'
const esmOutputDir = './dist/esm'

let task: string

async function main() {
  task = process.argv[2]

  if (!task) {
    log('Please provide a task name')
    process.exit(1)
  }

  log(`- starting task: ${task}`)

  switch (task) {
    case 'npmInstallAll':
      await runInExamples('npm', ['install'], allExamples)
      break
    case 'cleanPackedDir':
      cleanPackedDir()
      break
    case 'updateCjsOutput':
      updateCjsOutput()
      break
    case 'insertVersionNumbers':
      insertVersionNumbers()
      break
    case 'updateExampleDependencies':
      await updateExampleDependencies(allExamples)
      break
    case 'updateEsmExampleDependency':
      updateExampleDependencies([ESM])
      break
    case 'updateCjsExampleDependency':
      updateExampleDependencies([CJS])
      break
    case 'updateTsExampleDependency':
      updateExampleDependencies([TS_TS_NODE])
      break
    case 'cleanDist':
      cleanDist()
      break
    case 'smokeTest':
      await runInExamples('npm', ['run', 'transpileSwigfile'], [TS_ESM], traceEnabled)
      await runInExamples('npx', ['swig', 'list'], allExamples, traceEnabled)
      break
    default:
      log(`- task not found: ${task}`)
      process.exit(1)
  }
}

interface SpawnResult {
  code: number
  stdout: string
  stderr: string
  cwd?: string
}

async function spawnAsync(command: string, args: string[], options: SpawnOptions, liveOutput = false): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const result: SpawnResult = {
      stdout: '',
      stderr: '',
      code: 99,
      cwd: options.cwd?.toString()
    }

    const proc = spawn(command, args, options)

    proc.stdout?.on('data', (data) => {
      result.stdout += data
      if (liveOutput) {
        log(data.toString())
      }
    })

    proc.stderr?.on('data', (data) => {
      result.stderr += data
      if (liveOutput) {
        console.error(data.toString())
      }
    })

    proc.on('error', (error) => {
      trace(`Error for cwd: ${options.cwd}`)
      trace(error)
      reject(`Spawned process encountered an error: ${error}`)
    })

    proc.on('close', (code) => {
      if (code === null) {
        reject(`Spawned process returned a null result code: ${command}`)
      } else {
        result.code = code
        resolve(result)
      }
    })
  })
}

async function runInExamples(command: string, args: string[], examples: string[], printOutput = false) {
  const fullCommand = `${command} ${args.join(' ')}`
  log(`- running ${fullCommand} in example projects`)
  const promises: Promise<SpawnResult>[] = []
  for (const example of examples) {
    const cwd = `./examples/${example}/`
    log(`- running ${fullCommand} in example project ${example}`)
    promises.push(spawnAsync(command, args, { cwd }))
  }
  const promiseResults = await Promise.allSettled(promises) as PromiseSettledResult<SpawnResult>[]
  const rejected = promiseResults.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
  const fulfilled = promiseResults.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<SpawnResult>[]
  const results = fulfilled.map(r => r.value)
  const nonZeroStatusResults = results.filter(r => r.code !== 0)

  if (printOutput) {
    results.forEach(r => {
      if (r.stdout) {
        log('\n------------------------')
        log(`stdout for '${fullCommand}' in '${r.cwd}':`)
        log(r.stdout)
      }
      if (r.stderr) {
        log('\n------------------------')
        log(`stderr for '${fullCommand}' in '${r.cwd}':`)
        log(r.stderr)
      }
    })
  }

  if (rejected.length > 0 || nonZeroStatusResults.length > 0) {
    if (rejected.length > 0) {
      rejected.forEach(rej => console.error('rejected reason: ' + rej.reason))
    }
    if (nonZeroStatusResults.length > 0) {
      nonZeroStatusResults.forEach(r => console.error(r))
    }
    exit(1, `- Error(s) running ${command} in examples`)
  }
}

function cleanPackedDir() {
  if (existsSync('./packed')) {
    rmdirSync('./packed', { recursive: true })
  }
  mkdirSync('./packed')
}

function cleanDist() {
  if (existsSync('./dist')) {
    rmdirSync('./dist', { recursive: true })
  }
  mkdirSync('./dist')
}

async function updateExampleDependencies(examplesToUpdate: string[]) {
  log('- updating example projects with dependency on packed version of swig-cli')
  const packedDir = './packed'
  const files = readdirSync(packedDir)
  if (!files) {
    exit(1, '- Error: no files found in packed dir')
  }
  if (files.length !== 1) {
    exit(1, '- Error: there should only be one file in packed dir')
  }
  const packedFilename = files[0]
  const relativePackedPath = '../../packed/' + packedFilename

  await runInExamples('npm', ['i', '-D', relativePackedPath], examplesToUpdate)
}

function updateCjsOutput() {
  const filenames = readdirSync(cjsOutputDir)
  for (const filename of filenames) {
    if (!filename.includes('.js')) {
      continue
    }
    const oldPath = `${cjsOutputDir}/${filename}`
    const newPath = `${cjsOutputDir}/${filename.replace('.js', '.cjs')}`
    renameSync(oldPath, newPath)
  }

  const updatedFilenames = readdirSync(cjsOutputDir)
  for (const filename of updatedFilenames) {
    updateCjsFileContents(cjsOutputDir, filename)
  }

  const packageJson = readFileSync('./package.cjs.json', 'utf8')
  writeFileSync(`${cjsOutputDir}/package.json`, packageJson, 'utf8')
}

// Do replacements (except in special file where we only do one replacement):
// .js" -> .cjs"
// .js' -> .cjs'
// .js.map -> .cjs.map
function updateCjsFileContents(dir: string, filename: string) {
  const filePath = `${dir}/${filename}`
  const fileContents = readFileSync(filePath, 'utf8')
  let newFileContents = fileContents
  if (filename !== primaryCodeFilenameCjs) {
    newFileContents = newFileContents.replace(/\.js"/g, '.cjs"')
    newFileContents = newFileContents.replace(/\.js'/g, '.cjs\'')
  }
  newFileContents = newFileContents.replace(/\.js\.map/g, '.cjs.map')
  writeFileSync(filePath, newFileContents, 'utf8')
}

function insertVersionNumbers() {
  const packageJson = readFileSync('./package.json', 'utf8')
  const packageJsonObj = JSON.parse(packageJson)
  const version = packageJsonObj.version

  const esmFile = `${esmOutputDir}/${primaryCodeFilenameEsm}`
  const cjsFile = `${cjsOutputDir}/${primaryCodeFilenameCjs}`

  insertVersionNumber(esmFile, version)
  insertVersionNumber(cjsFile, version)
}

function insertVersionNumber(file: string, version: string) {
  let fileContents = readFileSync(file, 'utf8')
  if (!existsSync(file)) {
    log(`skipped inserting version because of missing file: ${file}`)
  }
  fileContents = fileContents.replace(/__VERSION__/g, version)
  writeFileSync(file, fileContents, 'utf8')
}

function exit(exitCode: number, messageOrError: unknown) {
  if (exitCode > 0) {
    console.error(messageOrError)
  } else {
    log(messageOrError)
  }
  process.exit(exitCode)
}

function log(message?: unknown, ...optionalParams: unknown[]) {
  console.log(message, ...optionalParams)
}

function trace(message?: unknown, ...optionalParams: unknown[]) {
  if (traceEnabled) { console.log(message, ...optionalParams) }
}

main().then(() => {
  exit(0, `- finished task ${task}`)
}).catch(err => {
  exit(1, err)
})

