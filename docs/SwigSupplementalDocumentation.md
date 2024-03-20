# Swig Supplemental Documentation

## Async vs Sync Functions and Typescript Method Signatures

You can technically pass non-async functions to `series` and `parallel`, but it's not recommended as it may lead to subtle bugs. To avoid issues, mark your functions with `async` even if there's nothing async happening. You will also notice that if you're using a typescript swigfile and you have type checking, it will complain about any functions not matching these types (you'll get an error like `Argument of type '() => void' is not assignable to parameter of type 'TaskOrNamedTask'`):

```Typescript
export type Task = () => Promise<any>
export type NamedTask = [string, Task]
```

More on `NamedTask` below under [Anonymous Functions and Named Anonymous Functions](#anonymous-functions-and-named-anonymous-functions).

## Individual Single Function Tasks

The `series` and `parallel` methods are really handy, but sometimes you may just want to run one single function, which you can do by simply exporting a regular function in your swigfile:

```JavaScript
export async function doStuff() {...}
```

Then run it with:
```bash
# Global swig-cli install
swig doStuff

# OR local swig-cli install
npx swig doStuff
```

## Anonymous Functions and Named Anonymous Functions

You can pass anonymous functions to `series` and `parallel`.

Example of using an anonymous function:

```javascript
async function doStuff() {
  console.log('log message from doStuff')
}

export const yourTask = series(
  doStuff,
  () => { console.log('This is a console message from an anonymous task') }
)
```

```
[11:27:19.432] Starting 🚀 doStuff
log message from doStuff
[11:27:19.432] Finished ✅ doStuff after 0 ms
[11:27:19.433] Starting 🚀 anonymous
This is a console message from an anonymous task
[11:27:19.433] Finished ✅ anonymous after 0 ms
```

This is really handy if you have a library of helper methods that you want to easily be able to pass in as one-liners while using params from your script, all without re-defining new wrapper functions or creating factory functions. For example:

```javascript
import { syncEnvFiles, emptyDirectory, ensureDockerUp } from 'my-lib'

// Example script var
const dockerProjectName = '...'

// Example helper method/sub-task
async function runIntegrationTests() { /* ... */ }

// Export your task to be run by swig
export const build = series(
  parallel(
    () => await syncEnvFiles('.env', [clientDir, serverDir, dockerDir]),
    () => await emptyDirectory(clientBuildDir),
    () => await emptyDirectory(serverBuildDir)
  ),
  () => await ensureDockerUp(dockerProjectName),
  prepBuild,
  parallel(
    buildClient,
    buildServer
  ),
  parallel(
    () => await myLib.copyDirectory(clientBuildDir, clientReleaseDir),
    () => await myLib.copyDirectory(serverBuildDir, serverReleaseDir)
  ),
  runIntegrationTests
)
```

And if you don't want the output to log your methods as "`anonymous`" as shown further above, you can use a tuple with a label to use with your anonymous function (`NamedTask = [string, Task]`):

```javascript
export const build = series(
  prepBuild,
  parallel(buildClient, buildServer),
  ['copyClientBuild', () => await copyDirectory(clientBuildDir, clientReleaseDir)],
  ['copyServerBuild', () => await copyDirectory(serverBuildDir, serverReleaseDir)]
)
```
Example output with named anonymous tasks:
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

Nice!

## Error Behavior

I've setup the default behavior to be fairly simple:

- If a function called by series throws an error, no further task executions later in the series will occur
- If a function called by parallel throws an error:
  - All sibling functions within the same parallel call will be allowed to continue
  - All errors for all functions in the same parallel call that threw errors will have the error they threw logged to the console at the end of execution (in addition to whatever logging you have setup in the functions themselves)
  - Execution will stop after all methods in the same parallel call return

If you have more complicated error behavior requirements, you can simply write up something custom, like setting and checking global state vars in your swigfile (although this is probably an unlikely scenario for most use cases).

## Typescript Notes

For a typescript swigfile.ts to work, you need to install one of these Node.js typescript loaders as a dev dependency in your project: [tsx](https://github.com/esbuild-kit/tsx) OR [ts-node](https://typestrong.org/ts-node/docs/). At the time of writing, ts-node doesn't work well with ESM and tsx is significantly faster, so tsx is the current recommended loader.

For ts-node, note that I'm using the `-T` option under the hood to speed up execution ([`--transpileOnly`](https://typestrong.org/ts-node/docs/options#transpileonly)). There's valid reasons not to use this, but I generally rely on the IDE along with plugins like eslint plugins to find "compile-time" errors when I'm using ts-node in a dev situation rather than slowing down the execution with these *types of checks* (see what I did there?). And if you don't use a good IDE for some reason, you'll still get some of the errors - you'll just see them at a slightly different spot in the execution process. But there are plenty of scenarios where this will let you shoot yourself in the foot, so be aware if you're writing code in Notepad.exe or something. In the future I'd like to allow overriding swig's default ts-node config so this and other ts-node options can be changed.

If you don't want to install ts-node or want to do your own transpilation, you can have 2 swigfiles in your directory and it'll pick the first one it finds, starting with the non-typescript versions. So if you have `swigfile.ts` file and maybe you have it automatically being transpiled to `swigfile.js`, then swig will pick up and use the `swigfile.js` version instead of using ts-node. Don't forget to setup live watching of your swigfile if you're actively making changes and re-running it (such as with `tsc --watch` or whatever tool you're using).You wouldn't want to end up in a situation where something isn't doing what you think it should only because it doesn't have your latest changes.

UPDATE for using ts-node: for NodeJS versions greater than or equal to 18.19, you will need to add this to your tsconfig.json in order to get the `transpileOnly` option:

```json
"ts-node": {
  "transpileOnly": true
}
```

UPDATE for tsx: `tsx` will not currently work correctly for all functionality in a CommonJS project. Either switch to `ts-node` or change the project to ESM.

## Recommended Usage

My recommendation is to install `swig-cli` as as global npm package (`npm i -g swig-cli`) because it will run much faster (no initial delay from npm/npx - see below), and you can type less.

My opinion is that running stuff through npx and npm aliases is annoying because of the initial delay on each task execution. For me this delay can be anywhere between 1 second and 4-8 seconds for some reason. That's not all that long, but it feels like an eternity when running a task that should only take a few milliseconds. This is why I prefer and recommend using a global install of `swig-cli` so you can call `swig` directly without incurring the startup delay.

## Using Npx

If you choose not to install `swig-cli` globally (see above) and don't want to use npm aliases (see below), then you will need to prefix all your commands with `npx`:

```
npx swig yourTask
```

## Npm Aliases

This isn't the recommended approach, but if you choose to use npm aliases anyway, you could setup a single alias like this:

```json
"scripts": {
  "swig": "swig"
}
```

And then call it with :

```bash
npm run swig yourTask
```

Or if you really like npm aliases for each individual task, then you could do something like this:

```json
"scripts": {
  "swig": "swig",
  "build": "swig build",
  "test": "swig test"
}
```

So that you can run your tasks like this:

```
npm run build
npm run test
npm run swig someOtherTask
```

But just to re-iterate, using npm aliases isn't the recommended approach. The idea behind swig is to be able to run `swig` and quickly see all the available commands without even having to open the package.json file or experience the slowness of npm.

## Other Commands

Use the command `swig help` to see other available commands:

```
Usage: swig <command or taskName> [options]
Commands:
  <taskName> - Run a "task", which is an async function exported from your swigfile
    swig taskName
  list, ls, l - List available tasks (default)
    swig list
  help, h - Show help message
    swig help
  version, v - Print version number
    swig version
  filter, f - Filter and list tasks by name
    swig filter pattern
Initialize or update a swig project: npx swig-cli-init@latest
```

Note that these are essentially "reserved words". If you define exported tasks with these names in your swigfile, they'll never take precedence over the built-in swig params.

Also note the `filter` command (also the shortened version `f`), which is handy if you have long list of commands and want to show only those with a particular substring (case insensitive). For example, list all tasks that have `db` in their names:

```bash
swig f db
```
