# swig

Swig is a simple CLI tool for automating dev workflows via compositions of series and parallel tasks.

## Why Swig Instead of Gulp?

Gulp is great, but it seems like overkill on projects that just need a way to compose series and parallel dev tasks. At the time of writing (2023-08-28), the npm package [howfat]() reports gulp as being quite the beast:

```
npx howfat@latest gulp
gulp@4.0.2 (457 deps, 9.55mb, 3468 files, ©MIT)
```

My transpiled source file is currently 270 lines and I have exactly 0 dependencies. It's small and fast. Obviously if you need all the other great stuff gulp has, than that's probably the way to go. But if you just need something lightweight and/or are annoyed by the security warnings they refuse to address, than swig should be a decent option.

Ultimately, I really just wanted a library with the following:

- series
- parallel
- file manipulation
- control to fix or improve functionality

For working with files, node's built-in `fs` module works just fine for me.

For `series` and `parallel` I decided to try and implement this in such a way that I can also pass in anonymous functions with name labels and get appropriate logging. This will be very convenient for developing a library of generic helper methods and calling them directly in the composition instead of re-defining all the methods again, just to get a method name logged with each sub-task.

I also wanted to experiment with developing a library using typescript and publishing both CommonJS and ESM compatible versions while also allowing use of different file types for the swigfile.

## Swig Documentation

Below you will find instructions on how to setup and use swig. If you'd like to make changes to the library or are just curious about my dev strategy, see [./docs/SwigDevNotes.md](./docs/SwigDevNotes.md).

There are also example projects that show different combinations of project types (based on the package.json `"type"` being `"module"` or not) and `swigfile` extension types. These are located in the `examples` directory of this repository.

### Getting Started

High level steps to get started (see more detail in the rest of the docs):

- (Optional) Install swig globally for convenient shortened CLI commands:
```
npm i -g swig-cli@latest
```
- Install `swig-cli` package as dev dependency (this is required regardless of global install so that you can import `series` and `parallel`):
```
npm i -D swig-cli
```
- Determine what your project type is (ESM or CommonJS based on your project's package.json `"type"` property, or lack thereof)
- Create a `swigfile.js` in the root of your project (or in whatever directory you plan on running the swig commands from). There are multiple options to name this file, so choose based on what your project type is and what flavor of JavaScript syntax you want to use in your swigfile.
- Create a package.json script alias so you can run `swig` easily (not necessarily required if you plan on using the global install and aren't using one of the combos that requires it):
```
"scripts": {
  "swig": "swig"
}
```
- Add some tasks to your swigfile. Any exported function will do, but the magic happens when you start composing functions together with `series` and `parallel` - see examples below.
- List detected tasks from your swigfile:
```JavaScript
// Global install
swig list
// Local install
npm run swig list
```
- Run a task:
```JavaScript
// Global install
swig yourTask
// Local install
npm run swig yourTask
```


### Series, Parallel and Composability

A dev task like `build` might have several steps where some steps can happen in parallel and others must happen sequentially. So we define each of the steps as functions and compose them into an exported build task:

Sample swigfile contents:
```JavaScript
async function buildPrep() {...}
async function buildServer() {...}
async function buildClient() {...}
async function postBuild() {...}

export const build = series(buildPrep, parallel(buildClient, buildServer), postBuild)
```

Then we can run this with `swig build`. See below for various ways to execute `swig`.

### Swig Installation: Global vs Package Local

You can install swig globally, or as a dependency within a project.

To install globally:

```
npm i -g swig-cli@latest
```

Then you can run commands directly in any project without going through npm:

```
swig list
```

While installing globally is convenient, there are several reasons why you may not want that. To install locally in your project:

```
npm i -D swig-cli@latest
```

Then you can add an alias in your package.json `"scripts"` section for convenience. For the esm version:

```
"swig": "swig"
```

For the cjs (CommonJS) version:

```
"swig": "swig-cjs"
```

Then you can run the package local version with:

```
npm run swig list
```

### Swigfile

The `swigfile` is where you define all your tasks and compose them together into exported top level tasks that swig can run.

Swig will look for one of these, in this order:
- `swigfile.cjs`
- `swigfile.mjs`
- `swigfile.js`
- `swigfile.ts`

Swigfile info:

- Swig will only be able to run functions that you export from your swigfile. If you define functions but don't export them, swig will not show that function in the list of available tasks when you run `swig list` and it will throw an error about that task being missing if you attempt to call swig with a non-exported function name as the param.
- Make sure the swigfile extension matches your project (more on that below)
- The file must be import-able. This means there must be no errors and no invalid syntax for whichever type you're using. Some examples:
    - If you're using commonjs then you must use `exports.yourTask = async function yourTask(){}` instead of the esm style `export const yourTask = async function yourTask(){}`
    - If you're using commonjs you can use `require` but if you're using esm you must only use `import`
- The file should not execute anything immediately that you don't want to be run every time any swig task is run. It should usually only define functions and composable tasks. You're welcome to put any valid code in your swigfile as long as it doesn't prevent the file from being imported and you intend for any immediately executed code to be run every time any swig task is executed.

### Async vs Sync Functions and Typescript Method Signatures

You can technically pass non-async functions to `series` and `parallel`, but it's not recommended. Also, if you're using a Typescript swigfile, it will complain about non-async functions not matching these types:

```Typescript
export type Task = () => Promise<any>
export type NamedTask = [string, Task]
export type TaskOrNamedTask = Task | NamedTask
```

More on `NamedTask` below under [Anonymous Functions and Named Anonymous Functions](#anonymous-functions-and-named-anonymous-functions).

### Individual Single Function Tasks

The `series` and `parallel` methods are really handy, but sometimes you may just want to run one single function, which you can do by simply exporting a regular function in your swigfile:

```JavaScript
export async function doStuff() {...}
```

Then run it with:
```JavaScript
// Global swig install
swig doStuff
// Local swig install
npm run swig doStuff
```

### Anonymous Functions and Named Anonymous Functions

You can pass anonymous functions to `series` and `parallel`, but when it logs start and finish events, it will just call it "anonymous".

Example of using an anonymous function:

```
async function doStuff() {
  console.log('log message from doStuff')
}
export const yourTask = series(doStuff, async () => { console.log('This is a console message from an anonymous task') })
```

```
[6:00:21 PM] Starting 🚀 doStuff
log message from doStuff
[6:00:21 PM] Finished ✅ doStuff after 6 ms
[6:00:21 PM] Starting 🚀 anonymous
This is a console message from an anonymous task
[6:00:21 PM] Finished ✅ anonymous after 1 ms
```

This is really handy if you have a library of helper methods that you want to easily be able to pass in as one-liners:

```
export const build = series(
  prepBuild,
  parallel(buildClient, buildServer),
  () => copyDirectory(clientBuildDir, clientReleaseDir),
  () => copyDirectory(serverBuildDir, serverReleaseDir)
)
```

And if you don't want the output to say things like "Starting 🚀 anonymous" as shown above, you can use a tuple with a label to use with your anonymous function (Typescript type `NamedTask` exported from swig):

```
export const build = series(
  prepBuild,
  parallel(buildClient, buildServer),
  ['copyClientBuild', () => copyDirectory(clientBuildDir, clientReleaseDir)],
  ['copyServerBuild', () => copyDirectory(serverBuildDir, serverReleaseDir)]
)
```

```
[6:09:26 PM] Starting 🚀 prepBuild
[6:09:26 PM] Finished ✅ prepBuild after 12 ms
[6:09:26 PM] Starting 🚀 nested_parallel_1
[6:09:26 PM] Starting 🚀 buildClient
[6:09:26 PM] Starting 🚀 buildServer
[6:09:26 PM] Finished ✅ buildClient after 0 ms
[6:09:26 PM] Finished ✅ buildServer after 1 ms
[6:09:26 PM] Finished ✅ nested_parallel_1 after 2 ms
[6:09:26 PM] Starting 🚀 copyClientBuild
[6:09:26 PM] Finished ✅ copyClientBuild after 1 ms
[6:09:26 PM] Starting 🚀 copyServerBuild
[6:09:26 PM] Finished ✅ copyServerBuild after 0 ms
```

Wow! Nice!

### Recommended Project Type Swigfile Type Combo

There's a lot of possible different combinations, but the recommended approach is to use ESM syntax in a `swigfile.js` in ESM projects and `swigfile.mjs` to still have ESM syntax even in CommonJS projects.

### Project Types and Swigfile File Extensions and Package.json Script Alias

I've attempted to publish `swig` so that it can be used in a variety of project types with several "dialects" that can be used in the swigfile. For examples, take a look at the `examples` directory in this project and take note of the different package.json/file combinations that I've tested. See above for my recommended setup: [recommended setup](#recommended-project-type-swigfile-type-combo).

For a basic example of another setup, let's say you like CommonJS and your project's package.json `"type"` property is set to `"commonjs"` (or left off to default to CommonJS), then you can use `swigfile.js` and use CommonJS syntax like `require` and `exports.yourFunc` and your npm alias would be `"swig": "swig-cjs"` instead of the ESM version `"swig": "swig"`.

And if you like ESM and your project.json `"type"` is set to `"module"` (ESM), then you can use `swigfile.js` or `swigfile.mjs` and your npm alias would just be `"swig": "swig"`.

However, note that you may run into mismatches depending on your setup. For example if your project package.json `"type"` is set to `"module"` (ESM), and you use `swigfile.js`, but use CommonJS syntax in that file, you'll get an error when it tries to import that file. Instead, you'll want to use ESM syntax in your file. In this same scenario, if you rename the file to `swigfile.cjs` then it will run it, but will probably do weird/bad things unless you also change your package.json script alias from `"swig": "swig"` to `"swig": "swig-cjs"`.

In general you should try and match your swigfile type/style to your project type. In addition to ensuring your swigfile can be loaded and executed, you'll want your normal IDE support for whatever dialect you chose. So, just because you can technically use a `swigfile.mjs` (ESM) in your CommonJS project, but you may not get the best possible IDE support because your package.json is set to CommonJS.

### Typescript `swigfile.ts`

If you want to use typescript for your swigfile you have a few options, although please note that I have done very little testing on this, and only with Typescript version 5.2.2 and ts-node version 10.9.1.

Typescript is great and makes JavaScript suck way less, but note that it's not my first recommended choice for this particular task. For my recommended approach, see above: [recommended setup](#recommended-project-type-swigfile-type-combo).

#### Option 1: run `swigfile.ts` directly with `ts-node`

Define your package.json script alias to point directly to the CJS specific version of swig (`swig-cli.cjs`) file, called by `ts-node`:

```
"scripts": {
  "swig": "ts-node -T ./node_modules/swig-cli/dist/cjs/swig-cli.cjs"
},
```

Notes on the `ts-node` option:

- `-T` is for `--transpileOnly` which is a little faster than without it (your IDE can do the type checking, no need to transpile every time you run it).
- The CJS version of swig is being used because ESM can't import a typescript file directly.
- Your project typescript settings (tsconfig.json) might affect how ts-node executes the swigfile. I haven't done a lot of testing here, so your mileage may vary.

#### Option 2: transpile your `swigfile.ts` to `swigfile.js` whenever you make changes

Define your package.json script aliases (assuming you have typescript installed locally in your project with `npm i -D typescript` so we can use `tsc`):

```
"scripts": {
  "transpileSwig": "tsc --target ESNext --module NodeNext --moduleResolution NodeNext swigfile.ts",
  "swig": "swig"
  // OR to just transpile it every time:
  "swig": "npm run transpileSwig && swig"
},
```

Notes on the transpilation option:

- You'll have 2 swigfiles in your solution (swigfile`.js` and swigfile`.ts`), which isn't great.
- It's okay to have both swigfile in your solution from the CLI tool's perspective, but note that it'll take the first one, so it'll always use `swigfile.js` even if there is also a `swigfile.ts`.
- You might accidentally run your swigfile`.js` without transpiling and getting new changes from swigfile`.ts`, which isn't great. You can workaround that by including the transpilation in your script alias, but that'll add a noticeable delay whenever you run a swig task, which isn't great.
- Running the `.js` version is actually a lot faster than using ts-node, so when not making changes, it can be really snappy, which is not a bad thing. It's possible you're not making changes to your swigfile very often if they're just build scripts you got working once and you just run them afterwords, only updating them rarely.
- This option is actually a little safer than the ts-node option because you're not relying on tsconfig settings possibly breaking things (or different versions of typescript and ts-node).
- Perhaps in the future I'll build in a way to check if the file needs to be transpiled and if so do it automatically, and store it in a git-ignored directory specified by some config value.

### Disclaimers

- This package is pretty alpha. I've tested with several combinations of ESM, CommonJS and Typescript, but I've only tested with NodJS v18.
- Unit tests haven't been added - I've only wired up some basic smoke tests for trying out different project/swigfile combos.
- Parallel is neat, but in practice JavaScript is still only single-threaded, so this will have more advantages in some cases than others. I have a dotnet prototype that is truly parallel/multi-threaded, so stay tuned for that if you projects that could benefit from multi-threaded processing.
- Pay no attention to the wonky tasks.cjs in this project - I plan on doing some cleanup once I feel the core functionality is solid.
