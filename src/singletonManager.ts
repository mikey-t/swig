import Swig from './Swig.js'

let instance: Swig

export function getSwigInstance() {
  if (!instance) {
    instance = new Swig()
  }
  return instance
}
