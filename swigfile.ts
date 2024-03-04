// Swig inception notes (using swig to orchestrate swig project dev tasks):
// - When developing swig, uninstall global version of swig-cli to avoid possible conflicts or ambiguity: volta uninstall swig-cli
// - Call swig with ".\swig.ps1" instead of "npx swig" in order to skip the npx delay
// - After done, re-install global version of swig-cli: volta install swig-cli@latest

import { emptyDirectory, getPowershellHackArgs, spawnAsync, spawnAsyncLongRunning, SpawnResult } from '@mikeyt23/node-cli-utils'
import { runParallel } from '@mikeyt23/node-cli-utils/parallel'
import { log } from 'node:console'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { parallel, series } from 'swig-cli'
import path from 'node:path'

const traceEnabled = true

const tscPath = './node_modules/typescript/lib/tsc.js'
const eslintPath = './node_modules/eslint/bin/eslint.js'

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

export async function npmInstallExamples() {
  await runInExamples('pnpm', ['install'], allExamples)
}

export async function cleanDist() {
  await emptyDirectory('./dist')
}

export async function buildEsm() {
  await spawnAsync('node', [tscPath, '--p', 'tsconfig.esm.json'])
}

export const buildCjs = series(doBuildCjs, updateCjsOutput)

export const build = series(cleanDist, parallel(buildEsm, buildCjs), insertVersionNumbers)

export async function watchEsm() {
  await spawnAsyncLongRunning('node', [tscPath, '--p', 'tsconfig.esm.json', '--watch'])
}

export async function watchCjs() {
  await spawnAsyncLongRunning('node', [tscPath, '--p', 'tsconfig.cjs.json', '--watch'])
}

export const pack = series(cleanPackedDir, doPack)

export const updateExamples = series(build, pack, updateAllExampleDependencies)

export const updateExamplesAndSmokeTest = series(updateExamples, smokeTest)

export async function smokeTest() {
  await runInExamples('npm', ['run', 'transpileSwigfile'], [TS_TRANSPILED], traceEnabled)
  await runInExamples('npx', ['swig', 'list'], allExamples, traceEnabled)
}

export async function cleanExamples() {
  const pathTuples: [string, string, string][] = []
  for (const example of allExamples) {
    pathTuples.push([
      path.resolve('examples', example, 'node_modules'),
      path.resolve('examples', example, 'package-lock.json'),
      path.resolve('examples', example, 'pnpm-lock.yaml')])
  }
  await runParallel(pathTuples, async (pathTuple) => {
    await spawnAsync('pwsh', getPowershellHackArgs(`remove-item -r -Force '${pathTuple[0]}'`))
    await spawnAsync('pwsh', getPowershellHackArgs(`remove-item -r -Force '${pathTuple[1]}'`))
  }, () => true)
}

export async function lint() {
  await spawnAsync('node', [eslintPath, '--ext', '.ts', './src', './swigfile.ts'])
}

export const publish = series(
  lint,
  build,
  updateExamplesAndSmokeTest,
  ['npmPublish', () => spawnAsync('npm', ['publish', '--registry=https://registry.npmjs.org/'])]
)

async function doBuildCjs() {
  await spawnAsync('node', [tscPath, '--p', 'tsconfig.cjs.json'])
}

async function cleanPackedDir() {
  await emptyDirectory('./packed')
}

async function doPack() {
  await spawnAsync('npm', ['pack', '--pack-destination', 'packed'])
}

async function updateAllExampleDependencies() {
  await updateExampleDependencies(allExamples)
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

  await runInExamples('pnpm', ['i', '-D', relativePackedPath], examplesToUpdate)
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
