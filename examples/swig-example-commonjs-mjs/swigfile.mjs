import { parallel, series } from 'swig-cli'

async function task1() {
  // console.log('This is a console message from task1')
  await sleep(50)
}

async function task2() {
  // console.log('This is a console message from task2')
  await sleep(50)
}

async function task3() {
  // console.log('This is a console message from task3')
  await sleep(50)
}

async function task4() {
  // console.log('This is a console message from task4')
  await sleep(50)
}

async function task5() {
  // console.log('This is a console message from task5')
  await sleep(50)
}

export async function task6() {
  // console.log('This is a console message from task6')
  await sleep(50)
}

async function task7() {
  await sleep(50)
}

async function task8() {
  await sleep(50)
}

async function task9() {
  await sleep(50)
  throw new Error('test error')
}

async function task10() {
  await sleep(50)
}

async function task11() {
  await sleep(50)
  throw new Error('test error')
}

async function task12() {
  await sleep(50)
}

function nonAsync() {
  console.log('This method is not async')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const test = series(task1, series(task2, task3))

export const allSeries = series(task1, task2, task3, task4, task5)
export const nestedSeries = series(task1, series(task2, task3), task4)
export const allParallel = parallel(task1, task2, task3, task4, task5)
export const mixed = series(task1, parallel(task2, task3), task4, task5)
export const nested = series(task1, parallel(task2, series(task3, task4)), task5, task6)
export const single = task1
export const withAnon = series(task1, async () => { console.log('This is a console message from an anonymous task') })
export const withNamedAnon = series(task1, ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }])
export const manyUseCases = series(
  task1,
  parallel(series(task2, parallel(task3, task4)), task5),
  series(task7, task8),
  task6,
  nonAsync,
  //parallel(task9, task10, task11, task12),
  async () => { console.log('This is a console message from an anonymous task') },
  ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }]
)

const clientBuildDir = '...'
const clientReleaseDir = ''
const serverBuildDir = ''
const serverReleaseDir = ''

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function copyDirectory(src, target) { }
async function prepBuild() { }
async function buildServer() { }
async function buildClient() { }

async function doStuff() {
  console.log('log message from doStuff')
}

export const yourTask = series(doStuff, async () => { console.log('This is a console message from an anonymous task') })

export const buildWithoutLabelsOnAnon = series(
  prepBuild,
  parallel(buildClient, buildServer),
  () => copyDirectory(clientBuildDir, clientReleaseDir),
  () => copyDirectory(serverBuildDir, serverReleaseDir)
)

export const build = series(
  prepBuild,
  parallel(buildClient, buildServer),
  ['copyClientBuild', () => copyDirectory(clientBuildDir, clientReleaseDir)],
  ['copyServerBuild', () => copyDirectory(serverBuildDir, serverReleaseDir)]
)
