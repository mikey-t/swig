// // Swig inception notes (using swig to orchestrate swig project dev tasks):
// // - When developing swig, uninstall global version of swig-cli to avoid possible conflicts or ambiguity: volta uninstall swig-cli
// // - Call swig with ".\swig.ps1" instead of "npx swig" in order to skip the npx delay (this will use the node_modules version)
// // - After done with swig development, re-install global version of swig-cli: volta install swig-cli@latest

import { Emoji, SpawnResult, copyDirectoryContents, emptyDirectory, ensureDirectory, spawnAsync, spawnAsyncLongRunning } from '@mikeyt23/node-cli-utils'
import { runParallel } from '@mikeyt23/node-cli-utils/parallel'
import { log } from 'node:console'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { parallel, series } from './node_modules/swig-cli/dist/esm/index.js'

const traceEnabled = true
const nodeTestVersionsImmutable = ['16.20.2', '18.18.2', '18.19.1', '20.11.1'] as const
const testTempDir = 'C:\\temp\\swig-test'
const testTempPackedDir = path.join(testTempDir, 'swig-cli-packed')
const usePackedForVersionTests = true

const nodeTestVersions: string[] = [...nodeTestVersionsImmutable]
type NodeVersion = typeof nodeTestVersionsImmutable[number]

const tscPath = './node_modules/typescript/lib/tsc.js'
const eslintPath = './node_modules/eslint/bin/eslint.js'
const tsxArgs = ['--no-warnings', '--import', 'tsx']
const transpiledExampleProject = 'ts-esm-transpiled'

const exampleProjects: string[] = [
  'cjs-cjs',
  'cjs-js',
  'cjs-mjs',
  'esm-cjs',
  'esm-js',
  'esm-mjs',
  'ts-cjs-tsnode',
  transpiledExampleProject,
  'ts-esm-tsnode',
  'ts-esm-tsx',
  'no-package',
  'no-swig-cli-installed',
  'no-swigfile',
  'no-ts-node'
]

const exampleProjectsToSkipNpmInstall = [
  'no-package',
  'no-swig-cli-installed',
  'no-ts-node'
]

const primaryCodeFilenameEsm = 'Swig.js'
const primaryCodeFilenameCjs = 'Swig.cjs'
const cjsOutputDir = './dist/cjs'
const esmOutputDir = './dist/esm'

let swigCopiedToTestTemp = false // This will be set in ensureSwigCopiedToVersionTestDir
let tempDirPackedSwigCliPath: string | undefined // This will be set in ensureSwigPackedCopiedToVersionTestDir

export async function npmInstallExamples() {
  await runInExamples('pnpm', ['install'], exampleProjects)
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

export async function cleanExamples() {
  const pathTuples: [string, string, string][] = []
  for (const example of exampleProjects) {
    pathTuples.push([
      path.resolve('examples', example, 'node_modules'),
      path.resolve('examples', example, 'package-lock.json'),
      path.resolve('examples', example, 'pnpm-lock.yaml')])
  }
  await runParallel(pathTuples, async (pathTuple) => {
    if (fs.existsSync(pathTuple[0])) {
      await fsp.rm(pathTuple[0], { force: true, recursive: true })
    }
    if (fs.existsSync(pathTuple[1])) {
      await fsp.rm(pathTuple[1])
    }
    if (fs.existsSync(pathTuple[2])) {
      await fsp.rm(pathTuple[2])
    }
  }, () => true)
}

export async function lint() {
  await spawnAsync('node', [eslintPath, '--ext', '.ts', './src', './test', './swigfile.ts'])
}

export const publish = series(
  lint,
  build,
  updateExamples,
  test,
  ['npmPublish', () => spawnAsync('npm', ['publish', '--registry=https://registry.npmjs.org/'])]
)

export const publishWithoutTesting = series(
  lint,
  build,
  ['npmPublish', () => spawnAsync('npm', ['publish', '--registry=https://registry.npmjs.org/'])]
)

export async function test(nodeVersion?: NodeVersion) {
  log(`${Emoji.Info} Running tests`)
  const isOnly = argPassed('o')
  if (isOnly) {
    log(`${Emoji.Info} Only running tests marked with "only" ("o" param was detected)`)
  }

  const result = await spawnAsync(
    'node',
    [
      ...tsxArgs,
      ...(isOnly ? ['--test-only'] : []),
      '--test',
      'test/Swig.test.ts'
    ],
    { env: { ...process.env, NODE_VERSION_TO_TEST: nodeVersion } }
  )

  if (result.code !== 0) {
    log(`${Emoji.Warning} If there have been any changes to examples, be sure to run the updateExamples swig task first`)
    throw new Error('Tests failed')
  }
}

// Pass "skip" CLI param to skip temp test dir prep (for faster dev loop when testing specific node version issues)
export const testNodeVersion = series(cleanTestNodePackedDir, doTestNodeVersion)

export const testAllNodeVersions = series(
  cleanTestNodePackedDir,
  () => doTestNodeVersion('16.20.2'),
  () => doTestNodeVersion('18.19.1'),
  () => doTestNodeVersion('20.11.1')
)

async function cleanTestNodePackedDir() {
  if (!testTempPackedDir.startsWith('C:\\temp\\')) {
    throw new Error(`unexpected testTempPackedDir: ${testTempPackedDir}`)
  }

  if (fs.existsSync(testTempPackedDir)) {
    await fsp.rm(testTempPackedDir, { force: true, recursive: true })
  }
}

async function doTestNodeVersion(nodeVersionOverride?: NodeVersion) {
  if (usePackedForVersionTests) {
    await ensureSwigPackedCopiedToVersionTestDir()
  } else {
    await ensureSwigCopiedToVersionTestDir()
  }

  const nodeVersion = nodeVersionOverride || getNodeVersionFromArg()
  log(`- testing node version: ${nodeVersion}`)
  await prepareNodeVersionTest(nodeVersion)
  await test(nodeVersion)
}

async function prepareNodeVersionTest(nodeVersion: NodeVersion) {
  const versionTestDir = path.join(testTempDir, `node-v${nodeVersion}`)
  log(`- setting test directory for examples at ${versionTestDir}`)
  if (argPassed('skip')) {
    log(`${Emoji.Info} Skipping example setup ("skip" param was detected)`)
    return
  }

  // Just to prevent accidental deletions - manually update if the var testTempDir changes
  if (!versionTestDir.startsWith('C:\\temp\\')) {
    throw new Error(`unexpected versionTestDir: ${versionTestDir}`)
  }

  if (fs.existsSync(versionTestDir)) {
    await fsp.rm(versionTestDir, { force: true, recursive: true })
  }

  for (const exampleProject of exampleProjects) {
    const sourceDir = path.join('./examples', exampleProject)
    const destDir = path.join(versionTestDir, exampleProject)
    await copyDirectoryContents(sourceDir, destDir, { exclusions: ['node_modules', 'pnpm-lock.yaml', 'package-lock.json'] })
  }

  const swigCliReferencePath = tempDirPackedSwigCliPath ?? '../../swig-cli'

  await runParallel<string, void>(exampleProjects, async exampleProject => {
    if (exampleProjectsToSkipNpmInstall.includes(exampleProject)) {
      return
    }
    const testExamplePath = path.join(versionTestDir, exampleProject)
    await spawnAsync('volta', ['pin', `node@${nodeVersion}`], { cwd: testExamplePath })
    await spawnAsync('pnpm', ['rm', 'swig-cli'], { cwd: testExamplePath })
    await spawnAsync('pnpm', ['i', '-D', swigCliReferencePath], { cwd: testExamplePath })
    await spawnAsync('pnpm', ['install'], { cwd: testExamplePath })
  }, () => true)
}

function argPassed(argName: string) {
  return process.argv.slice(3).includes(argName)
}

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
  await updateExampleDependencies([...exampleProjects])
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

async function updateExampleDependencies(examplesToUpdate: string[], usePacked = false) {
  let swigReferencePath = '../..'

  if (usePacked) {
    log('- updating example projects with dependency on packed version of swig-cli')
    const packedTarballName = await getPackedTarballName()
    swigReferencePath = '../../packed/' + packedTarballName
  } else {
    log('- updating example projects with parent directory link for swig-cli dependency')
  }

  await runInExamples('pnpm', ['i', '-D', swigReferencePath], examplesToUpdate.filter(x => !exampleProjectsToSkipNpmInstall.includes(x)))

  await runInExamples('npm', ['run', 'transpileSwigfile'], [transpiledExampleProject], traceEnabled)
}

async function getPackedTarballName() {
  const packedDir = './packed'
  const files = await fsp.readdir(packedDir)
  if (!files) {
    exit(1, '- Error: no files found in packed dir')
  }
  if (files.length !== 1) {
    exit(1, '- Error: there should only be one file in packed dir')
  }
  if (!files[0].startsWith('swig-cli-') || !files[0].endsWith('.tgz')) {
    exit(1, `- Error: unexpected packed tarball name: ${files[0]}`)
  }
  return files[0]
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

function isNodeVersion(str: unknown): str is NodeVersion {
  return !!str && typeof str === 'string' && nodeTestVersions.includes(str)
}

function getNodeVersionFromArg(): NodeVersion {
  const nodeVersionFromArg = process.argv[3]
  if (!isNodeVersion(nodeVersionFromArg)) {
    throw new Error(`Missing required param for node version (${nodeTestVersions.join(', ')})`)
  }
  return nodeVersionFromArg
}

function exit(exitCode: number, messageOrError: unknown) {
  if (exitCode > 0) {
    console.error(messageOrError)
  } else {
    log(messageOrError)
  }
  process.exit(exitCode)
}

async function ensureSwigCopiedToVersionTestDir() {
  log(`- ensuring built version of swig-cli has been copied to test directory`)
  if (swigCopiedToTestTemp) {
    return
  }
  swigCopiedToTestTemp = true

  const destDir = path.join(testTempDir, 'swig-cli')
  await ensureDirectory(destDir)

  const packageJson = 'package.json'
  const license = 'LICENSE'
  const readme = 'readme.md'

  const promises = [
    fsp.copyFile('./package.json', path.join(destDir, packageJson)),
    fsp.copyFile('./package.json', path.join(destDir, license)),
    fsp.copyFile('./package.json', path.join(destDir, readme)),
    copyDirectoryContents('./dist', path.join(destDir, 'dist'))
  ]

  await Promise.all(promises)
}

async function ensureSwigPackedCopiedToVersionTestDir() {
  if (tempDirPackedSwigCliPath) {
    return
  }
  const packedTarballName = await getPackedTarballName()
  tempDirPackedSwigCliPath = path.join(testTempPackedDir, await getPackedTarballName())
  await ensureDirectory(testTempPackedDir)
  await fsp.copyFile(path.join('./packed/', packedTarballName), tempDirPackedSwigCliPath)
}
