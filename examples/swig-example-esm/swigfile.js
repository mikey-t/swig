import { parallel, series } from 'swig-cli'
import { log } from 'node:console'

const SLEEP_MILLIS = 50

async function task1() {
  console.log('This is a console message from task1')
  await sleep(SLEEP_MILLIS)
}

async function task2() {
  console.log('This is a console message from task2')
  await sleep(SLEEP_MILLIS)
  // throw new Error('test error')
}

async function task3() {
  console.log('This is a console message from task3')
  await sleep(SLEEP_MILLIS)
  // throw new Error('test error')
}

async function task4() {
  console.log('This is a console message from task4')
  await sleep(SLEEP_MILLIS)
}

async function task5() {
  console.log('This is a console message from task5')
  await sleep(SLEEP_MILLIS)
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const allSeries = series(task1, task2, task3, task4, task5)
export const allParallel = parallel(task1, task2, task3, task4, task5)
export const mixed = series(task1, parallel(task2, task3), task4, task5)
export const single = task1
export const withAnon = series(task1, async () => { console.log('This is a console message from an anonymous task') })
export const withNamedAnon = series(task1, ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }])

export class MyClass {
  constructor() {}
}
