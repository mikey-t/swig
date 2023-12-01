## Swig Typescript Quick Start

Many project types and javascript flavors will work, but typescript with tsx is the recommended approach. Below are some simple steps to get a new project setup quickly. 

> These instructions assume you use Volta to manage NodeJS versions and would like to use NodeJS version 18 - adjust as necessary.

- Install swig-cli globally: `npm i -g swig-cli`
- Create a new directory and navigate to it
- `npm init -y`
- Update package.json so it has `"type": "module"`
- Create a tsconfig.json with something like this (the important settings are `target`, `module` and `moduleResolution`):
  ```
    {
      "compilerOptions": {
        "target": "ESNext",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "allowSyntheticDefaultImports": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "strict": true,
        "skipLibCheck": true,
        "types": [
          "node"
        ],
        "noEmit": true,
        "baseUrl": ".",
        "rootDir": "."
      },
      "include": [
        "swigfile.ts"
      ],
      "exclude": [
        "node_modules"
      ]
    }
  ```
- `npm i -D typescript tsx @types/node@18 swig-cli`
- Create a file `swigfile.ts` with this content:
```typescript
import { series } from 'swig-cli'

export const helloWorld = series(hello, world)

async function hello() {
  console.log('hello')
}

async function world() {
  console.log('world')
}
```
- Verify it's working with:
  - List available tasks: `swig helloWorld`
  - Run your `helloWorld` task: `swig helloWorld`
