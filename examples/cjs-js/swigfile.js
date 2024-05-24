const { series, parallel } = require('swig-cli')

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

async function task6() {
  console.log('task6 message')
}

exports.allSeries = series(task1, task2, task3, task4, task5)

exports.allParallel = parallel(task1, task2, task3, task4, task5)

exports.mixed = series(task1, parallel(task2, task3), task4, task5)

exports.single = task1

exports.withAnon = series(task1, async () => { console.log('anonymous task message') })

exports.withNamedAnon = series(task1, ['helloWorld', async () => { console.log('named anonymous task helloWorld') }])

exports.nested = series(task1, parallel(series(task2, parallel(task3, task4)), task5))

exports.task6 = task6

class MyClass {
  constructor() { }
}

exports.MyClass = MyClass
