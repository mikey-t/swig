import { parallel, series } from '@mikeyt23/swig'

async function task1() {
  console.log('This is a console message from task1')
  await sleep(50)
}

async function task2() {
  console.log('This is a console message from task2')
  await sleep(50)
}

async function task3() {
  console.log('This is a console message from task3')
  await sleep(50)
}

async function task4() {
  console.log('This is a console message from task4')
  await sleep(50)
}

async function task5() {
  console.log('This is a console message from task5')
  await sleep(50)
}

export async function task6() {
  console.log('This is a console message from task6')
  await sleep(50)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const allSeries = series(task1, task2, task3, task4, task5)
export const allParallel = parallel(task1, task2, task3, task4, task5)
export const mixed = series(task1, parallel(task2, task3), task4, task5)
export const nested = series(task1, parallel(task2, series(task3, task4)), task5, task6)
export const single = task1
export const withAnon = series(task1, async () => { console.log('This is a console message from an anonymous task') })
export const withNamedAnon = series(task1, ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }])
export const allUseCases = series(
  task1,
  parallel(series(task2, parallel(task3, task4)), task5),
  task6,
  async () => { console.log('This is a console message from an anonymous task') },
  ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }]
)
