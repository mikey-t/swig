# Swig Typescript Quick Start

## Pre-requisites

Required:

- Node.js version >= 20

Recommended additional tools:

- [Mise](https://mise.jdx.dev/getting-started.html)
- [Pnpm](https://pnpm.io/installation)

## Alternative Automated Setup

You can either follow the manual instructions below, or use the [swig-cli-init](https://github.com/mikey-t/swig-cli-init) npm package by simply running the following command:

```
npx swig-cli-init@latest
```

or with pnpm:

```
pnpx swig-cli-init@latest
```

## Setup Steps

Many project types and javascript flavors will work, but typescript with tsx is the recommended approach. Below are some simple steps to get a new project setup quickly. 

> These instructions assume you use [Mise](https://mise.jdx.dev/getting-started.html) to manage NodeJS versions and [pnpm](https://pnpm.io/installation) as an npm replacement.

- Install swig-cli globally: `pnpm i -g swig-cli@latest`
- Create a new directory and navigate to it
- `pnpm init -y`
- (optional) `mise use --pin node@24`
- Ensure package.json has `"type": "module"`
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
- `pnpm i -D typescript tsx @types/node@24 swig-cli@latest`
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
  - List available tasks: `swig`
  - Run your hello world task: `swig helloWorld`
