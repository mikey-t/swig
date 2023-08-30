import { Task, TaskOrNamedTask } from './Swig.js'
import { getSwigInstance } from './singletonManager.js'

export const series = (first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task => {
  return async () => {
    const swigInstance = getSwigInstance()
    const instanceSeries = swigInstance.series(first, ...rest)
    return instanceSeries()
  }
}

export const parallel = (first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task => {
  return async () => {
    const swigInstance = getSwigInstance()
    const instanceParallel = swigInstance.parallel(first, ...rest)
    return instanceParallel()
  }
}
