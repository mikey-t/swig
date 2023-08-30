/* eslint-disable @typescript-eslint/no-var-requires */
const { spawnSync } = require('child_process')
const fs = require('fs')

const TS = 'swig-example-typescript-ts-node'
const TS_ESM = 'swig-example-typescript-esm'
const CJS = 'swig-example-commonjs'
const CJS_MJS = 'swig-example-commonjs-mjs'
const ESM = 'swig-example-esm'
const ESM_CJS = 'swig-example-esm-cjs'
const allExamples = [TS, TS_ESM, CJS, CJS_MJS, ESM, ESM_CJS]
const primaryCodeFilenameEsm = 'Swig.js'
const primaryCodeFilenameCjs = 'Swig.cjs'
const cjsOutputDir = './dist/cjs'
const esmOutputDir = './dist/esm'

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
  case 'smokeTest':
    smokeTest(allExamples)
    break
  case 'smokeTestEsm':
    smokeTest([ESM])
    break
  case 'smokeTestCjs':
    smokeTest([CJS])
    break
  case 'smokeTestTs':
    smokeTest([TS])
    break
  case 'insertVersionNumbers':
    insertVersionNumbers()
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

function smokeTest(examplesToTest) {
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
    console.log('------------------')
    console.log(`- test output for ${exampleName}`)
    printSpawnResult(spawnResult)
    console.log('------------------')
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
  const filenames = fs.readdirSync(cjsOutputDir)
  for (const filename of filenames) {
    if (!filename.includes('.js')) {
      continue
    }
    const oldPath = `${cjsOutputDir}/${filename}`
    const newPath = `${cjsOutputDir}/${filename.replace('.js', '.cjs')}`
    fs.renameSync(oldPath, newPath)
  }

  const updatedFilenames = fs.readdirSync(cjsOutputDir)
  for (const filename of updatedFilenames) {
    updateCjsFileContents(cjsOutputDir, filename)
  }

  const packageJson = fs.readFileSync('./package.cjs.json', 'utf8')
  fs.writeFileSync(`${cjsOutputDir}/package.json`, packageJson, 'utf8')
}

// Do replacements (except in special file where we only do one replacement):
// .js" -> .cjs"
// .js' -> .cjs'
// .js.map -> .cjs.map
function updateCjsFileContents(dir, filename) {
  const filePath = `${dir}/${filename}`
  let fileContents = fs.readFileSync(filePath, 'utf8')
  let newFileContents = fileContents
  if (filename !== primaryCodeFilenameCjs) {
    newFileContents = newFileContents.replace(/\.js"/g, '.cjs"')
    newFileContents = newFileContents.replace(/\.js'/g, '.cjs\'')
  }
  newFileContents = newFileContents.replace(/\.js\.map/g, '.cjs.map')
  fs.writeFileSync(filePath, newFileContents, 'utf8')
}

function insertVersionNumbers() {
  const packageJson = fs.readFileSync('./package.json', 'utf8')
  const packageJsonObj = JSON.parse(packageJson)
  const version = packageJsonObj.version

  const esmFile = `${esmOutputDir}/${primaryCodeFilenameEsm}`
  const cjsFile = `${cjsOutputDir}/${primaryCodeFilenameCjs}`

  insertVersionNumber(esmFile, version)
  insertVersionNumber(cjsFile, version)
}

function insertVersionNumber(file, version) {
  let fileContents = fs.readFileSync(file, 'utf8')
  if (!fs.existsSync(file)) {
    console.log(`skipped inserting version because of missing file: ${file}`)
  }
  fileContents = fileContents.replace(/__VERSION__/g, version)
  fs.writeFileSync(file, fileContents, 'utf8')
}

function exit(exitCode, message) {
  console.log(message)
  process.exit(exitCode)
}

exit(0, `- finished task: ${task}`)
