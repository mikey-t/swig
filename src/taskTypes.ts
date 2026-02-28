import { isFunction } from './utils.js'

export type Task = () => Promise<unknown>
export type NamedTask = [string, Task]
export type TaskOrNamedTask = Task | NamedTask

export function isNamedTask(value: unknown): value is NamedTask {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    isFunction(value[1])
  )
}
