# Swig Typescript Quick Start

## Pre-requisites

Required:

- Node.js version 20

Recommended, but optional:

- [Volta](https://docs.volta.sh/guide/getting-started)
- [Pnpm](https://pnpm.io/installation)

## Alternative Automated Setup

You can either follow the manual instructions below, or use the [swig-cli-init](https://github.com/mikey-t/swig-cli-init) npm package by simply running the following command:

```
npx swig-cli-init@latest
```

Note that this requires you either have Node.js 20 or Volta installed.

## Setup Steps

Many project types and javascript flavors will work, but typescript with tsx is the recommended approach. Below are some simple steps to get a new project setup quickly. 

> These instructions assume you use Volta to manage NodeJS versions and would like to use NodeJS version 20 - adjust as necessary.

- Install swig-cli globally: `npm i -g swig-cli`
- Create a new directory and navigate to it
- `npm init -y`
- (optional) `volta pin node@20`
- Update package.json so it has `"type": "module"`
- Create a tsconfig.json with something like this (the important settings are `target`, `module` and `moduleResolution`):
  ```json
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
- `npm i -D typescript tsx @types/node@20 swig-cli`
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
