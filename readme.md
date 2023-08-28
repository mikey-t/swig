# swig

Swig is a simple CLI tool for automating dev workflows via compositions of series and parallel tasks.

## Why Swig Instead of Gulp?

Gulp always seems to have security warnings. The warnings are related to parts of Gulp that I've never used and don't have any plans on using. Perhaps these handful of critical audit warnings are technically ok to ignore since the build tool isn't meant to be run or even deployed to a production environment. But it really bothers me that they refuse to address these.

Ultimately, I really just wanted a library with the following:

- series
- parallel
- file manipulation
- control to fix or improve functionality

For working with files, node's built-in `fs` module works just fine.

For `series` and `parallel` I decided to try and implement this in such a way that I can also pass in anonymous functions with name labels and get appropriate logging. This will be very convenient for developing a library of generic helper methods and calling them directly in the composition instead of re-defining all the methods again, just to get a method name logged with each sub-task.

I also wanted to experiment with developing a library using typescript and publishing both CommonJS and ESM compatible versions while also allowing use of different file types for the swigfile.

## Swig Documentation

Below you will find high level instructions on how to setup and use swig. If you'd like to make changes to the library or are just curious about my dev strategy, see [./docs/SwigDevNotes.md](./docs/SwigDevNotes.md).

There are also example projects that show different combinations of project types (based on the package.json `"type"` being `"module"` or not) and `swigfile` extension types. These are located in the `examples` directory of this repository.

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


### Individual Single Function Tasks

You can also use a single plain old function as a swig task:

```JavaScript
export async function doStuff() {...}
```

Then run it with `swig doStuff`.

### Setup and Usage - CommonJS


### Setup and Usage - Typescript with ts-node


### Setup and Usage - ESM
