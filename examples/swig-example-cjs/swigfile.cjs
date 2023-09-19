const { series, parallel } = require('swig-cli')

async function task1() {
  console.log('this is task 1')
  await sleep(50)
}

async function task2() {
  console.log('this is task 2')
  await sleep(50)
}

async function task3() {
  console.log('this is task 3')
  await sleep(50)
}

async function task4() {
  console.log('this is task 4')
  await sleep(50)
}

async function task5() {
  console.log('this is task 5')
  await sleep(50)
}

async function task6() {
  console.log('this is task 6')
  await sleep(50)
}

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

exports.build = series(task1, parallel(task2, task3), parallel(task4, task5), task6)
exports.allSeries = series(task1, task2, task3, task4, task5)
exports.allParallel = parallel(task1, task2, task3, task4, task5)
exports.mixed = series(task1, parallel(task2, task3), task4, task5)
exports.single = task1
exports.withAnon = series(task1, async () => { console.log('This is a console message from an anonymous task') })
exports.withNamedAnon = series(task1, ['helloWorld', async () => { console.log('This is a console message from a named anonymous task called helloWorld') }])
