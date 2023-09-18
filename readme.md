# swig

Swig is a simple CLI tool for automating dev workflows via compositions of series and parallel tasks.

## Why Swig Instead of Gulp?

Why recreate the `series` and `parallel` functions that Gulp already has? I thank the gulp maintainers for all their work, but I wanted to move on to something better suited to my needs. For a list of contributing factors, see [./docs/SwigDevNotes.md#why-swig-instead-of-gulp](./docs/SwigDevNotes.md#why-swig-instead-of-gulp). 

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
| `.ts`    | commonjs            | ESM and/or CommonJS | Must have valid `tsconfig.json` options |
| `.ts`    | module              | ESM                 | Must have valid `tsconfig.json` options |

Note that use of typescript for your swigfile requires `ts-node` to be installed locally in your project as a dev dependency. Also note for typescript that your `tsconfig.json`, if you have one, needs to have settings that match whatever package.json type and swigfile.ts syntax you're using or you'll get an error when swig tries to dynamically import your swigfile. Specifically pay attention to the tsconfig.json option `compilerOptions` -> `module`. For example, if you're using package.json `type` of `module` and using `ESM` syntax in your `swigfile.ts`, then you probably want your `tsconfig.json` configured to `ESNext` or something similar for the compilerOptions module setting.

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

## Additional Documentation

- [./docs/SwigSupplementalDocumentation.md](./docs/SwigSupplementalDocumentation.md)
- [./docs/SwigDevNotes.md](./docs/SwigDevNotes.md)
