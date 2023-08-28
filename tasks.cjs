const { spawnSync } = require('child_process')
const fs = require('fs')

const TS = 'swig-example-typescript-ts-node'
const TS_ESM = 'swig-example-typescript-esm'
const CJS = 'swig-example-commonjs'
const CJS_MJS = 'swig-example-commonjs-mjs'
const ESM = 'swig-example-esm'
const allExamples = [TS, TS_ESM, CJS, CJS_MJS, ESM]

let task = process.argv[2]

if (!task) {
  console.log('Please provide a task name')
  process.exit(1)
}

console.log(`- starting task: ${task}`)

switch (task) {
  case 'npmInstallAll':
    npmInstallAll()
    break
  case 'cleanPackedDir':
    cleanPackedDir()
    break
  case 'updateCjsOutput':
    updateCjsOutput()
    break
  case 'updateExampleDependencies':
    updateExampleDependencies(allExamples)
    break
  case 'updateEsmExampleDependency':
    updateExampleDependencies([ESM])
    break
  case 'updateCjsExampleDependency':
    updateExampleDependencies([CJS])
    break
  case 'updateTsExampleDependency':
    updateExampleDependencies([TS])
    break
  case 'cleanDist':
    cleanDist()
    break
  case 'test':
    test(allExamples)
    break
  case 'testEsm':
    test([ESM])
    break
  case 'testCjs':
    test([CJS])
    break
  case 'testTs':
    test([TS])
    break
  default:
    console.log(`- task not found: ${task}`)
    process.exit(1)
}

function npmInstallAll() {
  allExamples.forEach(exampleName => {
    npmInstall(exampleName)
  })
}

function npmInstall(exampleName) {
  const cwd = `./examples/${exampleName}/`
  console.log(`- running npm install for example project ${exampleName}`)
  const result = spawnSync('npm', ['i'], { cwd })
  if (result.status !== 0) {
    console.log(`non-zero status result running npm install for project ${exampleName} and cwd ${cwd}`)
    console.log(result)
  }
}

function cleanPackedDir() {
  if (fs.existsSync('./packed')) {
    fs.rmdirSync('./packed', { recursive: true })
  }
  fs.mkdirSync('./packed')
}

function updateExampleDependencies(examplesToUpdate) {
  console.log('- updating example dependencies')
  const packedDir = './packed'
  const files = fs.readdirSync(packedDir)
  if (!files) {
    exit(1, '- Error: no files found in packed dir')
  }
  if (files.length !== 1) {
    exit(1, '- Error: there should only be one file in packed dir')
  }
  const packedFilename = files[0]
  const relativePackedPath = '../../packed/' + packedFilename
  examplesToUpdate.forEach(exampleName => { addExampleDependency(exampleName, relativePackedPath) })
}

function addExampleDependency(exampleName, relativePackedPath) {
  const cwd = `./examples/${exampleName}/`
  console.log(`- adding local packed dependency for project ${exampleName}`)
  const result = spawnSync('npm', ['i', '-D', relativePackedPath], { cwd })
  if (result.status !== 0) {
    console.log(`non-zero status result adding dependency for project ${exampleName} and cwd ${cwd}`)
    console.log(result)
  }
}

function cleanDist() {
  if (fs.existsSync('./dist')) {
    fs.rmdirSync('./dist', { recursive: true })
  }
  fs.mkdirSync('./dist')
}

function test(examplesToTest) {
  const results = []
  examplesToTest.forEach(exampleName => {
    results.push(testExample(exampleName))
  })
  printTestResults(results)
}

function testExample(exampleName) {
  const cwd = `./examples/${exampleName}/`
  console.log(`- testing example ${exampleName}`)
  const result = spawnSync('npm', ['run', 'swig', 'list'], { cwd })
  return [exampleName, result]
}

function printTestResults(results) {
  results.forEach(result => {
    const exampleName = result[0]
    const spawnResult = result[1]
    console.log('------------')
    console.log(`- test output for ${exampleName}`)
    printSpawnResult(spawnResult)
    console.log('------------')
  })
  const failedResults = results.filter(result => result[1].status !== 0)
  if (failedResults.length > 0) {
    exit(1, `- Error: some tests failed: ${failedResults.map(result => result[0]).join(', ')}`)
  } else {
    exit(0, '- All tests passed')
  }
}

function printSpawnResult(result) {
  console.log(`status: ${result.status}`)
  const stdout = result.stdout.toString()
  const stderr = result.stderr.toString()
  if (stdout) {
    console.log('stdout:')
    console.log(stdout)
  }
  if (stderr) {
    console.log('stderr:')
    console.log(stderr)
  }
}

function updateCjsOutput() {
  const cjsDir = './dist/cjs'
  const files = fs.readdirSync(cjsDir)
  if (!!files) {
    for (const file of files) {
      if (!file.includes('.js')) {
        continue
      }
      const oldPath = `${cjsDir}/${file}`
      const newPath = `${cjsDir}/${file.replace('.js', '.cjs')}`
      fs.renameSync(oldPath, newPath)
    }
  }
  // Update swig-cli.cjs.map contents (swig-cli.js -> swig-cli.cjs)
  const mapPath = `${cjsDir}/swig-cli.cjs.map`
  const mapContents = fs.readFileSync(mapPath, 'utf8')
  const newMapContents = mapContents.replace('swig-cli.js', 'swig-cli.cjs')
  fs.writeFileSync(mapPath, newMapContents, 'utf8')

  // Update swig-cli.cjs contents (swig-cli.js.map -> swig-cli.cjs.map)
  const cjsPath = `${cjsDir}/swig-cli.cjs`
  const cjsContents = fs.readFileSync(cjsPath, 'utf8')
  const newCjsContents = cjsContents.replace('swig-cli.js.map', 'swig-cli.cjs.map')
  fs.writeFileSync(cjsPath, newCjsContents, 'utf8')
}

function exit(exitCode, message) {
  console.log(message)
  process.exit(exitCode)
}

exit(0, `- finished task: ${task}`)
