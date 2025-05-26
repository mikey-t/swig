import { SimpleSpawnResult, log, simpleSpawnAsync } from '@mikeyt23/node-cli-utils'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import test, { after, describe, it } from 'node:test'

const exampleProjects = [
  'cjs-cjs',
  'cjs-js',
  'cjs-mjs',
  'esm-cjs',
  'esm-js',
  'esm-mjs',
  'ts-cjs-tsnode',
  'ts-esm-transpiled',
  'ts-esm-tsnode',
  'ts-esm-tsx'
]

// If non-empty, only these example projects will be tested
const projectsToTestOverride: string[] = []
// const projectsToTestOverride: string[] = ['ts-esm-tsx']
// const projectsToTestOverride: string[] = ['ts-cjs-tsnode']
// const projectsToTestOverride: string[] = ['cjs-cjs']
// const projectsToTestOverride: string[] = ['ts-esm-tsnode']

const logFailedResults = true
const logAllTaskResults = false
const nodeTestVersionsImmutable = ['16.20.2', '18.16.1', '18.19.0', '20.19.2', '22.16.0', '24.1.0'] as const
const nodeVersionTestBaseDir = 'C:\\temp\\swig-test'

const nodeTestVersions: string[] = [...nodeTestVersionsImmutable]
type NodeVersion = typeof nodeTestVersionsImmutable[number]

const nodeVersionFromEnv = process.env['NODE_VERSION_TO_TEST']
if (nodeVersionFromEnv !== undefined && !isNodeVersion(nodeVersionFromEnv)) {
  throw new Error(`Unrecognized node version passed: ${nodeVersionFromEnv}`)
}
const nodeVersion: NodeVersion | undefined = isNodeVersion(nodeVersionFromEnv) ? nodeVersionFromEnv : undefined
const nodeVersionTestDir = path.join(nodeVersionTestBaseDir, `node-v${nodeVersion}`)

const nodeVersionMessage = nodeVersion
  ? `${nodeVersion} (in directory ${nodeVersionTestDir})`
  : `current version directly in examples directory (${process.version})`
log(`node version to test: ${nodeVersionMessage}`)

const swigRelativePath = 'node_modules/swig-cli/dist/SwigStartupWrapper.js'

// Use the installation of swig-cli from the ts-esm-tsx example project for the cases where swig isn't installed
const tsEsmTsxSwigStartupWrapperRelativePath = '../ts-esm-tsx/node_modules/swig-cli/dist/SwigStartupWrapper.js'

const examplesDir = path.resolve(process.cwd(), 'examples')

const getAdjustedExampleDir = (exampleDirName: string) => {
  return nodeVersion !== undefined
    ? path.join(nodeVersionTestDir, exampleDirName)
    : path.join(examplesDir, exampleDirName)
}

// This is the volta error code for failed execution (instead of the normal "1" that would occur if running node directly)
const expectedErrorCode = 126

const exampleProjectsToTest = projectsToTestOverride.length > 0 ? projectsToTestOverride : exampleProjects

const expectedTasks = [
  'allParallel',
  'allSeries',
  'mixed',
  'single',
  'task6',
  'withAnon',
  'withNamedAnon'
]

const numberedTaskMessages = [
  'task1 message',
  'task2 message',
  'task3 message',
  'task4 message',
  'task5 message',
]

let numAsserts = 0

for (const exampleProject of exampleProjectsToTest) {
  describe(`basic tests for example project ${exampleProject}`, () => {
    const examplePath = path.join(examplesDir, exampleProject)
    const swigStartupWrapperPath = path.join(examplePath, swigRelativePath)

    test('example project exists and is ready to test', async () => {
      if (!fs.existsSync(examplePath)) {
        assert.fail(`example project path was not found: ${examplePath}`)
      }
      numAsserts++

      if (!fs.existsSync(swigStartupWrapperPath)) {
        assert.fail(`example project swig startup wrapper path not found: ${swigStartupWrapperPath}`)
      }
      numAsserts++
    })

    it('outputs all tasks for no params and list param', async () => {
      // No params should list all tasks
      let result = await getTaskResult(exampleProject, swigStartupWrapperPath)
      assertSuccessCode(result)
      for (const expectedTask of expectedTasks) {
        assertOutputHasString(result.stdout, expectedTask)
      }

      // "list" task should also list all tasks
      result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'list')
      assertSuccessCode(result)
      for (const expectedTask of expectedTasks) {
        assertOutputHasString(result.stdout, expectedTask)
      }
    })

    test('allParallel', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'allParallel')
      assertSuccessCode(result)
      for (const numberedTaskMessage of numberedTaskMessages) {
        assertOutputHasString(result.stdout, numberedTaskMessage)
      }
    })

    test('allSeries', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'allSeries')
      assertSuccessCode(result)
      for (const numberedTaskMessage of numberedTaskMessages) {
        assertOutputHasString(result.stdout, numberedTaskMessage)
      }
    })

    test('mixed', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'mixed')
      assertSuccessCode(result)
      for (const numberedTaskMessage of numberedTaskMessages) {
        assertOutputHasString(result.stdout, numberedTaskMessage)
      }
      assertOutputHasString(result.stdout, 'nested_parallel_1')
    })

    test('single', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'single')
      assertSuccessCode(result)
      assertOutputHasString(result.stdout, 'task1 message')
    })

    test('task6', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'task6')
      assertSuccessCode(result)
      assertOutputHasString(result.stdout, 'task6 message')
    })

    test('withAnon', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'withAnon')
      assertSuccessCode(result)
      assertOutputHasString(result.stdout, 'task1 message')
      assertOutputHasString(result.stdout, 'anonymous task message')
    })

    test('withNamedAnon', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'withNamedAnon')
      assertSuccessCode(result)
      assertOutputHasString(result.stdout, 'task1 message')
      assertOutputHasString(result.stdout, 'named anonymous task helloWorld')
    })

    test('nested', async () => {
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, 'nested')
      assertSuccessCode(result)
      for (const numberedTaskMessage of numberedTaskMessages) {
        assertOutputHasString(result.stdout, numberedTaskMessage)
      }
      assertOutputHasString(result.stdout, 'nested_parallel_1')
      assertOutputHasString(result.stdout, 'nested_parallel_2')
      assertOutputHasString(result.stdout, 'nested_series_1')
      assert.strictEqual(result.stdout.toLowerCase().includes('anonymous'), false, 'output should not have "anonymous" anywhere in the output - nested series and parallel calls should be labeled')
    })

    it('outputs an error for unknown task', async () => {
      const nonExistentTaskName = 'nonExistentTaskName'
      const result = await getTaskResult(exampleProject, swigStartupWrapperPath, nonExistentTaskName)
      assert.strictEqual(result.code, expectedErrorCode, `result code should be ${expectedErrorCode} for a non-existent task name`)
      numAsserts++
    })
  })
}

describe('no-package', () => {
  it('throws an error if there is no package.json file', async () => {
    const result = await getTaskResultSpecial('no-package')
    assert.strictEqual(result.code, expectedErrorCode)
    assert.match(result.stdout, /no package.json found - cannot detect project type/)
    numAsserts++
  })
})

describe('no-swig-cli-installed', () => {
  it('throws an error if swig-cli is not installed as a dependency', async () => {
    const result = await getTaskResultSpecial('no-swig-cli-installed')
    assert.strictEqual(result.code, expectedErrorCode)
    assert.match(result.stdout, /swig-cli was not found in the project dependencies or devDependencies - install with/)
    numAsserts++
  })
})

describe('no-swigfile', () => {
  it('throws an error if there is no swigfile', async () => {
    const result = await getTaskResultSpecial('no-swigfile', swigRelativePath)
    assert.strictEqual(result.code, expectedErrorCode)
    assert.match(result.stderr, /Task file not found - must be one of the following: swigfile.cjs, swigfile.mjs, swigfile.js, swigfile.ts/)
    numAsserts++
  })
})

describe('no-ts-node', () => {
  it('throws an error if typescript but no ts-node or tsx', async () => {
    const result = await getTaskResultSpecial('no-ts-node')
    assert.strictEqual(result.code, expectedErrorCode)
    assert.match(result.stdout, /typescript detected but a dev dependency is missing./)
    numAsserts++
  })
})

const getTaskResult = async (exampleProjectName: string, swigStartupWrapperPath: string, taskName?: string): Promise<SimpleSpawnResult> => {
  const exampleDirPath = getAdjustedExampleDir(exampleProjectName)
  const result = await simpleSpawnAsync('volta', ['run', 'node', swigStartupWrapperPath, ...(taskName ? [taskName] : [])], { cwd: exampleDirPath, throwOnNonZero: false })
  if (logAllTaskResults) {
    log(result)
  }
  return result
}

const getTaskResultSpecial = async (exampleName: string, swigPath: string = tsEsmTsxSwigStartupWrapperRelativePath) => {
  const result = await simpleSpawnAsync('volta', ['run', 'node', swigPath], { cwd: getAdjustedExampleDir(exampleName), throwOnNonZero: false })
  if (logAllTaskResults) {
    log(result)
  }
  return result
}

const assertSuccessCode = (spawnResult: SimpleSpawnResult) => {
  if (spawnResult.code !== 0 && logFailedResults) {
    log('failed spawn result:')
    log(spawnResult)
  }
  assert.strictEqual(spawnResult.code, 0)
  numAsserts++
}

const assertOutputHasString = (output: string, str: string) => {
  if (!output || !output.includes(str)) {
    assert.fail(`Output is missing string "${str}". Actual: ${output}`)
  }
  numAsserts++
}

after(() => {
  log(`numAsserts: ${numAsserts}`)
})

function isNodeVersion(str: unknown): str is NodeVersion {
  return !!str && typeof str === 'string' && nodeTestVersions.includes(str)
}
