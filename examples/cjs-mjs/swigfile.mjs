import { parallel, series } from 'swig-cli'

async function task1() {
  console.log('task1 message')
}

async function task2() {
  console.log('task2 message')
}

async function task3() {
  console.log('task3 message')
}

async function task4() {
  console.log('task4 message')
}

async function task5() {
  console.log('task5 message')
}

export async function task6() {
  console.log('task6 message')
}

export const allSeries = series(task1, task2, task3, task4, task5)

export const allParallel = parallel(task1, task2, task3, task4, task5)

export const mixed = series(task1, parallel(task2, task3), task4, task5)

export const single = task1

export const withAnon = series(task1, async () => { console.log('anonymous task message') })

export const withNamedAnon = series(task1, ['helloWorld', async () => { console.log('named anonymous task helloWorld') }])

export const nested = series(task1, parallel(series(task2, parallel(task3, task4)), task5))

export class MyClass {
  constructor() { }
}
