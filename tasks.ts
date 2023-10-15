import { SpawnOptions, spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'

const traceEnabled = true

const TS_CJS = 'swig-example-typescript-cjs'
const TS_ESM = 'swig-example-typescript-esm'
const TS_TSX = 'swig-example-typescript-tsx'
const TS_TRANSPILED = 'swig-example-typescript-transpiled'

const CJS = 'swig-example-cjs'
const CJS_MJS = 'swig-example-cjs-mjs'
const ESM = 'swig-example-esm'
const ESM_CJS = 'swig-example-esm-cjs'

const allExamples = [TS_CJS, TS_ESM, TS_TSX, TS_TRANSPILED, CJS, CJS_MJS, ESM, ESM_CJS]

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
      await cleanDir('./packed')
      break
    case 'updateCjsOutput':
      await updateCjsOutput()
      break
    case 'insertVersionNumbers':
      await insertVersionNumbers()
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
      updateExampleDependencies([TS_CJS])
      break
    case 'cleanDist':
      await cleanDir('./dist')
      break
    case 'smokeTest':
      await runInExamples('npm', ['run', 'transpileSwigfile'], [TS_TRANSPILED], traceEnabled)
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

    // Hack so that 'npm link swig-cli' works on windows with Volta installed
    let additionalArgs = {}
    if (args.length > 0 && args[0] === 'link') {
      additionalArgs = { env: process.env, shell: true, stdio: 'inherit' }
    }

    promises.push(spawnAsync(command, args, { cwd, ...additionalArgs }))
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

async function cleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true })
  }
  await fsp.mkdir(dir)
}

async function updateExampleDependencies(examplesToUpdate: string[]) {
  log('- updating example projects with dependency on packed version of swig-cli')
  const packedDir = './packed'
  const files = await fsp.readdir(packedDir)
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

async function updateCjsOutput() {
  const filenames = await fsp.readdir(cjsOutputDir)
  for (const filename of filenames) {
    if (!filename.includes('.js')) {
      continue
    }
    const oldPath = `${cjsOutputDir}/${filename}`
    const newPath = `${cjsOutputDir}/${filename.replace('.js', '.cjs')}`
    await fsp.rename(oldPath, newPath)
  }

  const updatedFilenames = await fsp.readdir(cjsOutputDir)
  for (const filename of updatedFilenames) {
    await updateCjsFileContents(cjsOutputDir, filename)
  }

  const packageJson = await fsp.readFile('./package.cjs.json', { encoding: 'utf8' })
  await fsp.writeFile(`${cjsOutputDir}/package.json`, packageJson, { encoding: 'utf8' })
}

// Do replacements (except in special file where we only do one replacement):
// .js" -> .cjs"
// .js' -> .cjs'
// .js.map -> .cjs.map
async function updateCjsFileContents(dir: string, filename: string) {
  const filePath = `${dir}/${filename}`
  const fileContents = await fsp.readFile(filePath, { encoding: 'utf8' })
  let newFileContents = fileContents
  if (filename !== primaryCodeFilenameCjs) {
    newFileContents = newFileContents.replace(/\.js"/g, '.cjs"')
    newFileContents = newFileContents.replace(/\.js'/g, '.cjs\'')
  }
  newFileContents = newFileContents.replace(/\.js\.map/g, '.cjs.map')
  await fsp.writeFile(filePath, newFileContents, { encoding: 'utf8' })
}

async function insertVersionNumbers() {
  const packageJson = await fsp.readFile('./package.json', { encoding: 'utf8' })
  const packageJsonObj = JSON.parse(packageJson)
  const version = packageJsonObj.version

  const esmFile = `${esmOutputDir}/${primaryCodeFilenameEsm}`
  const cjsFile = `${cjsOutputDir}/${primaryCodeFilenameCjs}`

  await insertVersionNumber(esmFile, version)
  await insertVersionNumber(cjsFile, version)
}

async function insertVersionNumber(file: string, version: string) {
  let fileContents = await fsp.readFile(file, 'utf8')
  if (!fs.existsSync(file)) {
    log(`skipped inserting version because of missing file: ${file}`)
  }
  fileContents = fileContents.replace(/__VERSION__/g, version)
  await fsp.writeFile(file, fileContents, { encoding: 'utf8' })
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
