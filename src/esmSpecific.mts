import { fileURLToPath } from 'url'

export const getFilename = () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fileURLToPath(import.meta.url)
}
