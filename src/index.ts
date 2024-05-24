import { getSwigInstance } from './singletonManager.js'
import { isFunction } from './utils.js'

/**
 * Any function that is async or returns a Promise.
 * See {@link TaskOrNamedTask} for more info.
 */
export type Task = () => Promise<unknown>

/**
 * A tuple (array with 2 values) of `[string, Task]` that can be used to provide a label for an anonymous function.
 * See {@link TaskOrNamedTask} for more info.
 */
export type NamedTask = [string, Task]

/**
 * Helper method to determine if something is a function. This is accomplished by returning false if `typeof` is explicitly
 * something other than "function" and also tries to ensure it's not actually a class by checking the existence and writability
 * of the argument's "prototype" property.
 */
export { isFunction } from './utils.js'

/**
 * Type guard method for {@link NamedTask}.
 */
export function isNamedTask(value: unknown): value is NamedTask {
  return (
    Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'string'
    && isFunction(value[1])
  )
}

/**
 * ```javascript
 * Task | NamedTask
 * ```
 *   - Any function that is async or returns a Promise
 *   - A tuple (array with 2 values) of `[string, Task]` that can be used to provide a label for an anonymous function
 * 
 * Example use of {@link Swig#series} and {@link Swig#parallel} with {@link Task} and {@link NamedTask} params:
 * 
 * ```javascript
 * series(
 *   task1,
 *   ['task2', async () => {}],
 *   task3,
 *   parallel(task4, ['task5', async () => {}])
 * )
 * ```
 */
export type TaskOrNamedTask = Task | NamedTask

/**
 * Call a list of async functions that are each a {@link TaskOrNamedTask} (see below) in order, waiting for each to complete before starting the next.
 * 
 * If any of the functions throws an error, the remaining functions will not be executed.
 * 
 * You may arbitrarily nest series and parallel calls since they are just async functions that return a {@link Task}.
 * 
 * ```javascript
 * Task | NamedTask
 * ```
 *   - Any function that is async or returns a Promise
 *   - A tuple (array with 2 values) of `[string, Task]` that can be used to provide a label for an anonymous function
 * 
 * Example use of {@link series} and {@link parallel} with {@link Task} and {@link NamedTask} params:
 * 
 * ```javascript
 * series(
 *   task1,
 *   ['task2', async () => {}],
 *   task3,
 *   parallel(task4, ['task5', async () => {}])
 * )
 * ```
 */
export const series = (first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task => {
  const innerSeries = async () => {
    const swigInstance = getSwigInstance()
    const instanceSeries = swigInstance.series(first, ...rest)
    return instanceSeries()
  }
  // Setting the name explicitly will prevent it from becoming 'anonymous' when executed later
  Object.defineProperty(innerSeries, 'name', { value: 'innerSeries', writable: false })
  return innerSeries
}

/**
 * Call a list of async functions that are each a {@link TaskOrNamedTask} (see below) in parallel.
 * 
 * Errors will not stop the execution of other functions in the current (inner) parallel method group,
 * but execution of further outer series/parallel calls will stop after the current inner parallel functions complete.
 * 
 * You may arbitrarily nest series and parallel calls since they are just async functions that return a {@link Task}.
 * 
 * ```javascript
 * Task | NamedTask
 * ```
 *   - Any function that is async or returns a Promise
 *   - A tuple (array with 2 values) of `[string, Task]` that can be used to provide a label for an anonymous function
 * 
 * Example use of {@link series} and {@link parallel} with {@link Task} and {@link NamedTask} params:
 * 
 * ```javascript
 * series(
 *   task1,
 *   ['task2', async () => {}],
 *   task3,
 *   parallel(task4, ['task5', async () => {}])
 * )
 * ```
 */
export const parallel = (first: TaskOrNamedTask, ...rest: TaskOrNamedTask[]): Task => {
  const innerParallel = async () => {
    const swigInstance = getSwigInstance()
    const instanceParallel = swigInstance.parallel(first, ...rest)
    return instanceParallel()
  }
  // Setting the name explicitly will prevent it from becoming 'anonymous' when executed later
  Object.defineProperty(innerParallel, 'name', { value: 'innerParallel', writable: false })
  return innerParallel
}
