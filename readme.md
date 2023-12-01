# swig

Swig is a simple CLI tool for automating dev workflows via compositions of series and parallel tasks.

## Why Swig Instead of Gulp?

Why recreate the `series`, `parallel` and task runner functionality that Gulp already has? Gulp is great, but I wanted to be able to customize how it works, strip out all the complexity and add the ability to use a variety of javascript/typescript flavors with little or no extra setup required.

## Typescript Quick Start

Swig does not require typescript, but it is the recommended approach. For instructions on quickly setting up a new project that uses swig with typescript, see [Swig Typescript Quick Start](./docs/SwigTypescriptQuickStart.md).

For general getting started, see instructions below.

## Getting Started

- (Optional) Install `swig-cli` globally for convenient shortened commands and much faster task execution (no initial delay from npm/npx):
  ```bash
  npm i -g swig-cli@latest
  ```
- Install `swig-cli` package as a dev dependency so you can import `series` and `parallel`:
  ```bash
  npm i -D swig-cli
  ```

- Create a `swigfile` in the root of your project, such as `swigfile.js` (see [Swigfile Syntax Options Matrix](#swigfile-syntax-options-matrix))
- Add some tasks to your swigfile. Any exported function will do, but the magic happens when you start composing functions together with `series` and `parallel` - see examples below.
- Add some tasks to your swigfile (see [Series, Parallel and Composability Example](#series-parallel-and-composability-example))
- List detected tasks from your swigfile (exported functions):
  ```JavaScript
  // Global install
  swig
  // Local install
  npx swig
  ```
- Run a task:
  ```JavaScript
  // Global install
  swig yourTask
  // Local install
  npx swig yourTask
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
| `.ts`    | commonjs            | ESM and/or CommonJS | Must have valid `tsconfig.json` options. Must use `ts-node` and not `tsx`. |
| `.ts`    | module              | ESM                 | Must have valid `tsconfig.json` options. May use either `ts-node` or `tsx`. |

If using typescript:

- You must install either `tsx` or `ts-node` as a dev dependency in your project. Note that `tsx` ESM functionality is advertised as being experimental, but it seems to work well, and also seems to have fewer issues than `ts-node`. You can install one of these by running `npm i -D tsx` or `npm i -D ts-node`.
- In a typescript project where the package.json is set to CommonJS, you will need to use `ts-node` and NOT `tsx`
- Your `tsconfig.json` needs to have settings that match your `package.json` type. For example, if you have your `package.json` type field set to `module`, then your `tsconfig.json` needs to have a `module` setting of "ES2020" or "ESNext" (something that supports ESM). See [Swig Typescript Quick Start](./docs/SwigTypescriptQuickStart.md) for an example `tsconfig.json` file.
- If using `ts-node`, speed up execution time by configuring it to skip type checking (this is only required for NodeJS version 18.19 and above):
  ```json
  "ts-node": {
    "transpileOnly": true
  }
  ```

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
// Global install
swig build
// Local install
npx swig build
```

## Example Projects

See [dotnet-react-sandbox](https://github.com/mikey-t/dotnet-react-sandbox) and it's use of [swig-cli-modules](https://github.com/mikey-t/swig-cli-modules) to encapsulate tasks for projects that use it as a template.

## NodeJS Version Support

NodeJS 18 is currently the only fully-tested version. However, NodeJS 16 and 20 LTS versions appear to also work. Lower versions might work for non-typescript projects, but are un-tested and not supported.

## Additional Documentation

- [./docs/SwigSupplementalDocumentation.md](./docs/SwigSupplementalDocumentation.md)
- [./docs/SwigDevNotes.md](./docs/SwigDevNotes.md)
