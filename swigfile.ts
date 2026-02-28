// Swig inception notes (using swig to orchestrate swig project dev tasks):
// - When developing swig, uninstall global version of swig-cli to avoid possible conflicts or ambiguity: pnpm rm -g swig-cli
// - Call swig with ".\swig.ps1" instead of "npx swig" or "pnpm exec swig" in order to skip the npx delay (this will use the node_modules version)
// - After done with swig development, re-install global version of swig-cli: pnpm add -g swig-cli@latest
// - Update referenced swig-cli version after new version is published

import { Emoji, SpawnResult, copyDirectoryContents, emptyDirectory, ensureDirectory, getConfirmation, simpleSpawnAsync, sleep, spawnAsync, spawnAsyncLongRunning, unpackTarball } from '@mikeyt23/node-cli-utils'
import { runParallel } from '@mikeyt23/node-cli-utils/parallel'
import { log } from 'node:console'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { parallel, series } from './node_modules/swig-cli/dist/esm/index.js'

const traceEnabled = true
// Important: NodeJS has a bug in versions >= 18.17.0 and <= 18.18.2 that prevents swig from being able to dynamically import a swigfile when used with tsx
const nodeTestVersionsImmutable = ['16.20.2', '18.16.1', '18.19.0', '20.19.2', '22.16.0', '24.1.0'] as const
const testTempDir = 'C:\\temp\\swig-test'
const testTempPackedDir = path.join(testTempDir, 'swig-cli-packed')
const usePackedForDefaultTests = true
const usePackedForVersionTests = true
const unzipToTempAfterPacking = false
const usePnpmForceOnSwigInstall = true
const rollupConfigEsm = 'rollup.config.esm.js'
const rollupConfigCjs = 'rollup.config.cjs.js'
const tsconfigEsm = 'tsconfig.esm.json'
const tsconfigCjs = 'tsconfig.cjs.json'
const npmRegistryArg = '--registry=https://registry.npmjs.org/'
const deleteNodeModulesSleepMillis = 250 // Sleeps are an attempt to avoid errors deleting esbuild.exe from node_modules
const deleteNodeModulesRetries = 5
const usePnpmLoglevelError = true
const pnpmLoglevelArgs = usePnpmLoglevelError ? ['--loglevel', 'error'] : []

const nodeTestVersions: string[] = [...nodeTestVersionsImmutable]
type NodeVersion = typeof nodeTestVersionsImmutable[number]

const tscPath = './node_modules/typescript/lib/tsc.js'
const eslintPath = './node_modules/eslint/bin/eslint.js'
const rollupPath = './node_modules/rollup/dist/bin/rollup'
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

let swigCopiedToTestTemp = false // This will be set in ensureSwigCopiedToVersionTestDir
let tempDirPackedSwigCliPath: string | undefined // This will be set in ensureSwigPackedCopiedToVersionTestDir

export async function cleanDist() {
  await emptyDirectory('./dist')
}

export async function lint() {
  await spawnAsync('node', [eslintPath, '--ext', '.ts', './src', './test', './swigfile.ts'])
}

export const build = series(
  cleanDist,
  parallel(
    ['rollupEsm', () => doRollup(rollupConfigEsm)],
    ['rollupCjs', () => doRollup('rollup.config.cjs.js')]
  ),
  parallel(
    removeUnnecessaryDistFiles,
    copyCjsPackageJsonToDist
  )
)

export const buildEsm = series(
  cleanDist,
  ['rollupEsm', () => doRollup(rollupConfigEsm)],
  removeUnnecessaryDistFiles
)

export const buildCjs = series(
  cleanDist,
  ['rollupCjs', () => doRollup(rollupConfigCjs)],
  parallel(
    removeUnnecessaryDistFiles,
    copyCjsPackageJsonToDist
  )
)

export async function tscEsm() {
  await spawnAsync('node', [tscPath, '--p', tsconfigEsm])
}

export async function tscCjs() {
  await spawnAsync('node', [tscPath, '--p', tsconfigCjs])
}

export async function watchEsm() {
  await doRollup(rollupConfigEsm, true)
}

export async function watchCjs() {
  await doRollup(rollupConfigCjs, true)
}

export const pack = series(cleanPackedDir, doPack, conditionallyUnpackToTemp)

export const buildAndUpdateExamples = series(build, pack, updateExamples)

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
      await sleep(deleteNodeModulesSleepMillis)
      await fsp.rm(pathTuple[0], { force: true, recursive: true, maxRetries: deleteNodeModulesRetries })
      await sleep(deleteNodeModulesSleepMillis)
    }
    if (fs.existsSync(pathTuple[1])) {
      await fsp.rm(pathTuple[1])
    }
    if (fs.existsSync(pathTuple[2])) {
      await fsp.rm(pathTuple[2])
    }
  }, () => true)
}

export const publish = series(
  lint,
  build,
  updateExamples,
  test,
  ['npmPublish', () => spawnAsync('npm', ['publish', npmRegistryArg])]
)

export const publishWithoutTesting = series(
  [
    'confirm',
    async () => {
      if (!(await getConfirmation('Are you sure you want to publish without running tests?'))) {
        throw new Error('Aborting')
      }
    }
  ],
  lint,
  build,
  ['npmPublish', () => spawnAsync('npm', ['publish', npmRegistryArg])]
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
export const testNodeVersion = series(cleanTestNodePackedDir, ensureSwigInVersionTestDir, doTestNodeVersion)

export const testAllNodeVersions = series(
  cleanTestNodePackedDir,
  ensureSwigInVersionTestDir,
  parallel(
    () => doTestNodeVersion('16.20.2'),
    () => doTestNodeVersion('18.16.1'),
    () => doTestNodeVersion('18.19.0'),
    () => doTestNodeVersion('20.19.2'),
    () => doTestNodeVersion('22.16.0'),
    () => doTestNodeVersion('24.1.0')
  )
)

export const testAllNodeVersionsInSeries = series(
  cleanTestNodePackedDir,
  ensureSwigInVersionTestDir,
  () => doTestNodeVersion('16.20.2'),
  () => doTestNodeVersion('18.16.1'),
  () => doTestNodeVersion('18.19.0'),
  () => doTestNodeVersion('20.19.2'),
  () => doTestNodeVersion('22.16.0'),
  () => doTestNodeVersion('24.1.0')
)

export async function npmInstallExamples() {
  await runInExamples('pnpm', ['install', ...pnpmLoglevelArgs], exampleProjects)
}

export async function updateExamples() {
  await updateExampleDependencies([...exampleProjects], usePackedForDefaultTests)
}

export const buildAndPack = series(build, pack)

async function cleanTestNodePackedDir() {
  if (!testTempPackedDir.startsWith('C:\\temp\\')) {
    throw new Error(`unexpected testTempPackedDir: ${testTempPackedDir}`)
  }

  if (fs.existsSync(testTempPackedDir)) {
    await fsp.rm(testTempPackedDir, { force: true, recursive: true })
  }
}

async function ensureSwigInVersionTestDir() {
  if (usePackedForVersionTests) {
    await ensureSwigPackedCopiedToVersionTestDir()
  } else {
    await ensureSwigCopiedToVersionTestDir()
  }
}

async function doTestNodeVersion(nodeVersionOverride?: NodeVersion) {
  const nodeVersion = nodeVersionOverride || getNodeVersionFromArg()
  log(`- testing node version: ${nodeVersion}`)
  await prepareNodeVersionTest(nodeVersion)
  await test(nodeVersion)
}

async function prepareNodeVersionTest(nodeVersion: NodeVersion) {
  const versionTestDir = path.join(testTempDir, `node-v${nodeVersion}`)
  log(`- setting up tests for version ${nodeVersion}`)
  await ensureNodePath(nodeVersion)
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
    await sleep(deleteNodeModulesSleepMillis)
    await fsp.rm(versionTestDir, { force: true, recursive: true, maxRetries: deleteNodeModulesRetries })
    await sleep(deleteNodeModulesSleepMillis)
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
    log(`- pnpm remove swig-cli for version ${nodeVersion} in example project ${exampleProject}`)
    await spawnAsync('pnpm', ['rm', 'swig-cli', ...pnpmLoglevelArgs], { cwd: testExamplePath, throwOnNonZero: false })
    log(`- pnpm install swig-cli for version ${nodeVersion} in example project ${exampleProject}`)
    await spawnAsync('pnpm', ['install', '-D', ...(usePnpmForceOnSwigInstall ? ['--force'] : []), ...pnpmLoglevelArgs, swigCliReferencePath], { cwd: testExamplePath })
    log(`- run pnpm install in directory for version ${nodeVersion} in example project ${exampleProject}`)
    await spawnAsync('pnpm', ['install', ...pnpmLoglevelArgs], { cwd: testExamplePath })
  }, () => true)
}

function argPassed(argName: string) {
  return process.argv.slice(3).includes(argName)
}

async function cleanPackedDir() {
  await emptyDirectory('./packed')
}

async function doPack() {
  await spawnAsync('pnpm', ['pack', '--pack-destination', 'packed'])
}

async function runInExamples(command: string, args: string[], examples: string[], printOutput = false) {
  const ignoreNonZero = args[0] === 'rm'
  const fullCommand = `${command} ${args.join(' ')}`
  log(`- running ${fullCommand} in example projects`)
  const promises: Promise<SpawnResult>[] = []
  for (const example of examples) {
    const cwd = `./examples/${example}/`
    log(`- running ${fullCommand} in example project ${example}`)
    promises.push(spawnAsync(command, args, { cwd, throwOnNonZero: !ignoreNonZero }))
  }
  const promiseResults = await Promise.allSettled(promises) as PromiseSettledResult<SpawnResult>[]
  const rejected = promiseResults.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
  const fulfilled = promiseResults.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<SpawnResult>[]
  const results = fulfilled.map(r => r.value)
  const nonZeroStatusResults = ignoreNonZero ? [] : results.filter(r => r.code !== 0)

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
    throw new Error(`- Error(s) running ${command} in examples`)
  }
}

async function updateExampleDependencies(examplesToUpdate: string[], usePacked = false) {
  let swigReferencePath = '../..'

  if (usePacked) {
    log('- updating example projects with dependency on packed version of swig-cli')
    const packedTarballName = await getPackedTarballName()
    swigReferencePath = '../../packed/' + packedTarballName
  } else {
    log('- updating example projects with parent directory reference for swig-cli dependency')
  }

  await runInExamples('pnpm', ['rm', 'swig-cli', ...pnpmLoglevelArgs], examplesToUpdate.filter(x => !exampleProjectsToSkipNpmInstall.includes(x)))

  await runInExamples('pnpm', ['i', '-D', ...(usePnpmForceOnSwigInstall ? ['--force'] : []), ...pnpmLoglevelArgs, swigReferencePath], examplesToUpdate.filter(x => !exampleProjectsToSkipNpmInstall.includes(x)))

  if (examplesToUpdate.includes(transpiledExampleProject)) {
    await runInExamples('pnpm', ['run', 'transpileSwigfile'], [transpiledExampleProject], traceEnabled)
  }
}

async function getPackedTarballName() {
  const packedDir = './packed'
  const files = await fsp.readdir(packedDir)
  if (!files) {
    throw new Error('- Error: no files found in packed dir')
  }
  if (files.length !== 1) {
    throw new Error('- Error: there should only be one file in packed dir')
  }
  if (!files[0].startsWith('swig-cli-') || !files[0].endsWith('.tgz')) {
    throw new Error(`- Error: unexpected packed tarball name: ${files[0]}`)
  }
  return files[0]
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
  const packedTarballName = await getPackedTarballName()
  tempDirPackedSwigCliPath = path.join(testTempPackedDir, await getPackedTarballName())
  await ensureDirectory(testTempPackedDir)
  await fsp.copyFile(path.join('./packed/', packedTarballName), tempDirPackedSwigCliPath)
}

async function conditionallyUnpackToTemp() {
  if (!unzipToTempAfterPacking) {
    log(`skipping unzip to temp ("unzipToTempAfterPacking" is set to false)`)
    return
  }
  await emptyDirectory('./temp')
  const packedPath = path.join('./packed/', await getPackedTarballName())
  await unpackTarball(packedPath, './temp')
}

async function removeUnnecessaryDistFiles() {
  const removeDistFiles = async (dir: string) => {
    const filenames = await fsp.readdir(dir)
    for (const filename of filenames) {
      if (filename.includes('.d.ts') && !filename.startsWith('index')) {
        const filePath = path.join(dir, filename)
        await fsp.rm(filePath)
      }
    }
  }
  await Promise.all([
    removeDistFiles('./dist/esm'),
    removeDistFiles('./dist/cjs')
  ])
}

async function doRollup(configFile: string, watch = false) {
  if (watch) {
    await spawnAsyncLongRunning('node', [rollupPath, '--config', configFile, '--watch'])
  } else {
    await spawnAsync('node', [rollupPath, '--config', configFile])
  }
}

async function copyCjsPackageJsonToDist() {
  const packageJson = await fsp.readFile('./package.cjs.json', { encoding: 'utf8' })
  await fsp.writeFile('./dist/cjs/package.json', packageJson, { encoding: 'utf8' })
}

async function ensureNodePath(version: string) {
  const nodeInstallVersionString = `node@${version}`
  log(`ensuring node ${version} is installed using command 'mise install ${nodeInstallVersionString}`)
  const installResult = await spawnAsync('mise', ['install', nodeInstallVersionString, '-q'])
  if (installResult.code !== 0) {
    throw new Error(`Failed to install ${nodeInstallVersionString}`)
  }
  log(`getting path to node executable for ${nodeInstallVersionString}`)
  const whereResult = await simpleSpawnAsync('mise', ['where', nodeInstallVersionString])
  if (whereResult.code !== 0) {
    throw new Error(`Failed to get node path for ${nodeInstallVersionString}`)
  }
  if (whereResult.stdoutLines.length > 1) {
    throw new Error(`Unexpected result getting node path for ${nodeInstallVersionString}. Command returned multiple lines: ${whereResult.stdoutLines.join(', ')}`)
  }
  if (whereResult.stdoutLines.length === 0) {
    throw new Error(`Failed to get path for ${nodeInstallVersionString}`)
  }
  const nodePath = path.join(whereResult.stdoutLines[0], 'node')
  log(`node path found: ${nodePath}`)
  return nodePath
}

export async function miseTest() {
  log('running new ensureNodePath method...\n')
  const nodePath = await ensureNodePath('20.19.2')
  log(`path: ${nodePath}`)
  log(`\nGetting output of "node -v" using path`)
  const nodeVersionResult = await simpleSpawnAsync(nodePath, ['-v'])
  log(nodeVersionResult)
}
