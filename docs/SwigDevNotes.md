# Swig Dev Notes

This doc is for misc dev notes about how to setup and use project, issues and gotchas, decisions made, future plans, etc.

## Startup Wrapper Script

There's some magic here that allows a lot of flexibility without the user really having to do much or know much about what's happening under the hood (or passing additional parameters, etc). In my first attempt at swig I had 2 executables: one for esm and one for cjs. And I forced the consumer to know which they should use and had lots of instructions in the readme about it. On top of that there were yet more instructions for typescript and there were all sorts of gotchas and scenarios that didn't quite work right.

The `SwigStartupWrapper` is the solution to that. Now there is only one executable, and in that startup logic, it does a bunch of checking of things to make sure it'll work and to conditionally choose the right combo of scripts to run, and whether to run ts-node or ts-node-esm if a typescript swigfile is present. Rather than continuing in the same startup process (that is always initially ESM), it spawns a new child process with whatever is needed, thus bypassing the need to explain all this to the consumer.

There are some obvious downsides to the specific implementation I've got going (see the TODO section below), but generally this seems to provide a much better user experience.

In addition to providing the mentioned flexibility, it also accidentally fixed an issue where running with an npm alias or npx was causing dash parameters to be hijacked by npm/npx. Which could really add a lot of confusion and headache for when consumers start defining tasks that evaluate process.argv for additional options, and those options are broken because of npm. Instead, the new process getting spawned is calling node directly, so npm/npx has no chance to screw things up.

## Rapid `Swig.ts` Dev Loop

Setup:

- In project root: `npm link`. This acts like installing it globally, which gives you the executable (`swig`) and allows other project to run `npm link swig-cli` to symlink to your live files (see below).
- In example dir:
    - `npm link swig-cli`. To see what's currently linked, you can run `npm ls --link=true`
- Now you can run commands in the example project dir to test using the global executable (e.g. `swig` instead of `npx swig`). This works because of the link command in the root of the project.

Clean up:
- In example dir:
    - `npm unlink swig-cli`
- In project root:
    - `npm unlink`
    - (optional depending on what you're doing) `npm run updateExamplesAndTest` (builds, packs and updates references in all example projects to packed version)

## Tsc Watch Gotcha

Running `npm run watch` (just `tsc --watch` currently) will use the default tsconfig.json, which is the ESM version, so you don't see any live changes if you're in the CJS example project. I haven't had a strong need to do live CJS testing yet since most paths go through the ESM version (pretty much everything except typescript in a commonjs project). If I do end up needing that, I'll want to add an additional package.json alias for `watchCjs` or something that passes the other tsconfig file. But will still need to remember that the startup wrapper script is pointed to the ESM version, so testing live start wrapper changes at the same time as CJS Swig.cjs isn't supported without some other changes.

## Why the CJS version?

It turns out you can get around the fact that ESM can't dynamically import a typescript file by using commonjs instead (which surprising can do this!). This is how I'm getting away with not transpiling the typescript swigfile before importing it - I'm just using the CJS version of swig for this scenario. Sneaky. But may want to look into a more robust solution if people start actually using this...

This is a little confusing because when I'm calling ts-node, it's not on a .ts file, so it goes like this:

swig -> SwigStartupWrapper -> node spawn child process -> Swig.cjs -> imports swigfile.ts dynamically

So the entry is always ESM, but really it's a combination of ts-node and the cjs version of the script that enables the dynamic typescript file import. There's probably other better ways to do this, which I'll look into.

## Volta Gotcha with Global Node CLI

This section assumes you're using volta for managing node/npm on your machine.

If you install a new version of `swig-cli` globally with `volta install swig-cli@latest`, it will correctly get the new version and install it, but if you run `swig` with this new version in a directory of a project that has an older version of `swig-cli` installed (so it's swigfile can import `series`/`parallel`), it will use the older version in the project-local node_modules. The volta folks advertise this as intended and the better way to handle global tools, which kinda makes sense I suppose. But kind of pain in this scenario.

If this ends up being a real problem, I might have to split the executable and the `series`/`parallel` exports to separate packages, or find some other similar solution to keep them more separate. Although, this isn't a problem with just `swig-cli` - this is problem across the board with globally installed npm packages (conflicts between global and project local versions).

## What's with all the Async Wrappers?

(read that title in Jerry Seinfeld's voice)

The trick to this whole operation is that you want to be able to import a javascript file and define pipelines using this syntax:

```javascript
export const someTask = series(task1, parallel(task2, task3), task4)
```

But if series wasn't a wrapper that returns a promise (same thing as returning a nested async function), then the function would get executed immediately on file import and the result would get assigned to a variable `someTask`, which isn't what we want. We want to read the file and then look at the exports and only execute the one function that was requested.

There might be other (and maybe better?) ways to do this, but javascript is actually really comfortable to pass around functions and promises as params, so it makes it feel relatively natural if you've done any async programming in javascript.

## TODO

- Setup unit testing (integration testing really) and add tests. See personal notes for list of needed tests I've kept track of so far.
- Test with different versions of NodeJS. Seems to work with NodeJS v16 and v18. Should also try v14 and pretty soon v20 will be a thing. Should also implement testing (smoke and integration) strategy to be able to verify this easily/regularly.
- Address obvious no-no of accessing node_modules directly (see section below)
- Provide way of overriding functionality via a config file like `.swig.json`
    - Override ts-node paths
    - Set alternate swigfile location
    - Suppress warnings from startup checks (such as for dual typescript/non-typescript swigfile where consumer is doing their own transpilation)

## TODO - address direct node_modules access issue

The new wrapper script makes swig 1000 times easier to use, but it is using direct paths to local node_modules for both ts-node and swig, which is probably a gigantic no-no for multiple reasons. I'll need to look into using a different strategy. Perhaps something like the "register" pattern or using an API to do the transpilation programmatically. 

Although keep in mind there's some really cool advantages to the current strategy:

- **Speed**. Calling the scripts directly instead of running through npm/npx is significantly faster.
- **Versatility**. I can call either bin-esm.js or bin.js and myScript.js or myScript.cjs depending on what their project is like and what the task definition file is.
- **Ease of setup**. No need to add an npm alias or call any additional params to register a transpiler - it just works.
- **Auto-documentation**.
    - If the consumer doesn't have ts-node installed, it will give them a friendly message that it's needed and what command to run
    - If the consumer is using a global install of swig but forgot to install it in their local project so they can import `series` and `parallel` into their swigfile, it'll give them a friendly message with the necessary command.
    - If they've got a mismatch in their task definition file syntax and the package.json type, it tells them what to change (file extension vs package.json vs task file syntax change).

But obviously, what if the paths to swig or ts-node change? We can add branching logic in the startup wrapper - that's kind of what it's for anyway - but that could become a maintenance nightmare. I'm thinking whether I divert from this strategy will depend on how often (if ever) ts-node change their bin paths and whether I want to take the hit of adding additional dependencies to resolve the path.

UPDATE: hey, let's just rely on something more standard, like the existence of `./node_modules/.bin/ts-node`! That file being there means it's installed, and parsing that file would make it pretty easy to find the executable. Seems a little hacky maybe, but as long as there's logging to say what path was chosen and why, that seems like a reasonable compromise IMO. Test by moving my swig executable location locally and verifying that it can still be found with the new "script finder" logic.
