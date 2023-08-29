import { parallel, series } from 'swig-cli'

async function task1() {
  console.log('This is a console message from task1')
}

async function task2() {
  console.log('This is a console message from task2')
}

async function task3() {
  console.log('This is a console message from task3')
}

async function task4() {
  console.log('This is a console message from task4')
}

async function task5() {
  console.log('This is a console message from task5')
}

export const allSeries = series(task1, task2, task3, task4, task5)
export const allParallel = parallel(task1, task2, task3, task4, task5)
export const mixed = series(task1, parallel(task2, task3), task4, task5)
export const single = task1
export const withAnon = series(task1, async () => { console.log('This is a console message from an anonymous task') })
export const withNamedAnon = series(task1, ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }])
