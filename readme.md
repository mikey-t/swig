# swig

Swig is a simple CLI tool for automating dev workflows via compositions of series and parallel tasks.

Write simple javascript or typescript functions and easily execute them in a shell in your project's root directory.

Fast. Simple. Convenient.

## Pre-requisites

Node.js >= 16 (version 20 is recommended)

## Why Swig Instead of Gulp?

Why recreate the "series", "parallel" and "task runner" functionality that Gulp already has? Gulp is great, but I wanted to be able to customize how it works, strip out all the noise and add the ability to use a variety of javascript/typescript flavors with little or no extra setup required.

## Typescript Quick Start

Swig does not require typescript, but it is the recommended approach. For instructions on quickly setting up a new project that uses swig with typescript, see [Swig Typescript Quick Start](./docs/SwigTypescriptQuickStart.md) (or simply run `npx swig-cli-init@latest` in your target directory).

For general getting started steps, continue below.

## Getting Started

- (Optional) Install `swig-cli` globally for convenient shortened commands and much faster task execution (no initial delay from npm/npx):
  ```bash
  # With npm:
  npm i -g swig-cli@latest

  # OR with pnpm:
  pnpm i -g swig-cli@latest
  ```
- Install `swig-cli` package as a dev dependency so you can import `series` and `parallel` in your swigfile:
  ```bash
  npm i -D swig-cli
  ```

- Create a `swigfile` in the root of your project, such as `swigfile.js` (see [Swigfile Syntax Options Matrix](#swigfile-syntax-options-matrix))
- Add some tasks to your swigfile (see [Series, Parallel and Composability Example](#series-parallel-and-composability-example))
- List detected tasks from your swigfile (exported functions):
  ```bash
  # Global swig-cli install
  swig

  # OR local swig-cli install
  npx swig
  
  # OR local swig-cli install with pnpm
  pnpm exec swig
  ```
- Run a task:
  ```bash
  # Global swig-cli install
  swig yourTask

  # OR local swig-cli install
  npx swig yourTask
  
  # OR local swig-cli install with pnpm
  pnpm exec swig yourTask
  ```

## Swigfile Syntax Options Matrix

Your `swigfile` can be one of the following:

- `swigfile.cjs`
- `swigfile.mjs`
- `swigfile.js`
- `swigfile.ts`

If there are multiple swigfiles in your project directory, swig will use the first one it finds, using the order above. The following shows the various options for your swigfile file extension, package.json `type` and javascript/typescript syntax flavor to use.

| Swigfile | package.json `type` | Syntax              | Notes |
|----------|---------------------|---------------------|-------|
| `.js`    | module              | ESM                 |       |
| `.js`    | commonjs            | CommonJS            |       |
| `.cjs`   | any                 | CommonJS            |       |
| `.mjs`   | any                 | ESM                 |       |
| `.ts`    | commonjs            | CommonJS | Must have valid `tsconfig.json` options. Must use `ts-node` and NOT `tsx` for CommonJS. |
| `.ts`    | module              | ESM                 | Must have valid `tsconfig.json` options. Must have either `tsx` or `ts-node` installed. |

If using typescript:

- You must install either `tsx` or `ts-node` as a dev dependency in your project. These are Node typescript loaders that allow immediate execution of typescript without a transpilation step. Note that `tsx` seems to have fewer issues than `ts-node`, and is much faster. You can install one of these by running `npm i -D tsx` OR `npm i -D ts-node`.
- In a typescript project where the package.json is set to CommonJS, you will need to use `ts-node` and NOT `tsx`
- Your `tsconfig.json` needs to have settings that match your `package.json` type. For example, if you have your `package.json` type field set to `module`, then your `tsconfig.json` needs to have a `module` setting of "ES2020" or "ESNext" (something that supports ESM). See [Swig Typescript Quick Start](./docs/SwigTypescriptQuickStart.md) for an example `tsconfig.json` file.
- If using `ts-node`, speed up execution time by configuring it to skip type checking (this is only required for NodeJS version 18.19 and above):
  ```json
  "ts-node": {
    "transpileOnly": true
  }
  ```
- Make sure your `tsconfig.json` has your `swigfile.ts` in it's `include` section in order to get IDE support
- If using eslint, ensure that your `swigfile.ts` is included in files that it checks
- If you're using swig to manage a typescript project and have conflicting tsconfig.json settings, consider using a separate file for your build, like `tsconfig.build.json` and build with something like `tsc --p tsconfig.build.json` (or alternatively, you could use another directory for swig other than your project's root directory)

## Series, Parallel and Composability Example

A dev task like `build` might have several steps where some steps can happen in parallel and others must happen sequentially. So we define each of the steps as functions and compose them into an exported task we're calling simply `build`:

Sample swigfile contents:
```JavaScript
async function buildPrep() {...}
async function buildServer() {...}
async function buildClient() {...}
async function postBuild() {...}

export const build = series(buildPrep, parallel(buildClient, buildServer), postBuild)
```

And then we can run it with :
```javascript
// Global swig-cli install
swig build

// OR local swig-cli install
npx swig build

// OR local swig-cli install with pnpm
pnpm exec swig build
```

## Example Projects

See [dotnet-react-sandbox](https://github.com/mikey-t/dotnet-react-sandbox) and it's use of [swig-cli-modules](https://github.com/mikey-t/swig-cli-modules) to encapsulate tasks for projects that use it as a template.

## Compatibility

### NodeJS Version Support

Node.js versions >= 16 are supported.

Tested Node.js versions:
- 16.20.2
- 18.16.1
- 18.19.0
- 20.19.2
- 22.16.0
- 24.1.0

**Important**: NodeJS and/or tsx has a bug that prevents swig from working with tsx for 18.17.x and 18.18.x versions. If you want to use the tsx variant of swig and have one of those versions, you'll need to either downgrade to 18.16.x (or below) or upgrade to 18.19.x (or above).

### Optional dependencies

Latest known working versions of optional dependencies for typescript variant projects:
- typescript: 5.9.3
- [tsx](https://github.com/privatenumber/tsx): 4.21.0
- [ts-node](https://github.com/TypeStrong/ts-node): 10.9.2

## Additional Documentation

- [./docs/SwigSupplementalDocumentation.md](./docs/SwigSupplementalDocumentation.md)
- [./docs/SwigDevNotes.md](./docs/SwigDevNotes.md)
