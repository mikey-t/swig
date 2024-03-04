# Swig Dev Notes

This doc is for misc dev notes about how to setup and use project, issues and gotchas, decisions made, future plans, etc.

## Why Swig Instead of Gulp

Some contributing factors that led me to create swig:

- Security warnings in gulp
- Gulp codebase seems less well-maintained than in the past
- Gulp documentation is partially out of date
- The size of gulp and the depth of it's dependency tree. Running `npx howfat@latest gulp` tells me it has approximately 3489 files, 459 transitive dependencies and 9.6MB.
- The complexity of gulp:
  - Gulp has a lot of opinionated filesystem manipulation, but the built-in NodeJS library `fs` has everything I need
  - I just need some very basic glue - I don't want all the opinionated error handling logic
  - I don't need an entire plugin architecture - I'm just gluing other things together
  - I don't need my collection of dev automation tasks to be runnable by CI - I just need a spot to automate all my local dev tasks
  - I don't need tools like a custom file watcher, I just need something to glue together other better tools
- I want to have more control over how it works
- I want easier setup with various different javascript and typescript flavors
- Gulp is hard to type...

## Startup Wrapper Script

There's some magic here that allows a lot of flexibility without the user really having to do much or know much about what's happening under the hood (or passing additional parameters, etc). In my first attempt at swig I had 2 executables: one for esm and one for cjs. And I forced the consumer to know which they should use and had lots of instructions in the readme about it. On top of that there were yet more instructions for typescript and there were all sorts of gotchas and scenarios that didn't quite work right.

The `SwigStartupWrapper` is the solution to that. Now there is only one executable, and in that startup logic, it does a bunch of checking of things to make sure it'll work and to conditionally choose the right combo of scripts to run, and whether to run ts-node or ts-node-esm if a typescript swigfile is present. Rather than continuing in the same startup process (that is always initially ESM), it spawns a new child process with whatever is needed, thus bypassing the need to explain all this to the user.

There are some obvious downsides to the specific implementation I've got going (see the TODO section below), but generally this seems to provide a much better user experience.

In addition to providing flexibility, the startup script also accidentally fixed an issue where running with an npm alias or npx was causing dash parameters to be hijacked by npm/npx. Which could really add a lot of confusion and headache for when consumers start defining tasks that evaluate process.argv for additional options, and those options are broken because of npm. Instead, the new process getting spawned is calling node directly, so npm/npx has no chance to screw things up.

## Rapid Dev Loop Using Example Project

Setup:

- In root of project, run (and leave running): `.\swig.ps1 watchEsm`
- In example project in another terminal, remove swig-cli and re-add it using the relative location:
    - `pnpm rm swig-cli`
    - `pnpm i -D ../../`


Clean up:
- Stop the process running the `watchEsm` task with ctrl + C
- Undo all example project swig-cli references by running: `.\swig.ps1 updateExamples`

## Why the CJS version?

It turns out you can get around the fact that ESM can't dynamically import a typescript file by using commonjs instead (which surprising can do this!). This is how I'm getting away with not transpiling the typescript swigfile before importing it - I'm just using the CJS version of swig for this scenario. Sneaky. But may want to look into a more robust solution in case this doesn't work out in some scenarios.

This is a little confusing because when I'm calling ts-node, it's not on a .ts file, so it goes like this:

swig -> SwigStartupWrapper -> node spawn child process -> Swig.cjs -> imports swigfile.ts dynamically

So the entry is always ESM, but really it's a combination of ts-node and the cjs version of the script that enables the dynamic typescript file import. There might be other better ways to do this - I'll look into it.

## Volta Gotcha with Global Node CLI

I'm using Volta for managing node/npm on my machine - you can ignore this if you don't use Volta.

If you install a new version of `swig-cli` globally with `volta install swig-cli@latest`, it will correctly get the new version and install it, but if you run `swig` with this new version in a directory of a project that has an older version of `swig-cli` installed (so it's swigfile can import `series`/`parallel`), it will use the older version in the project-local node_modules. The volta folks advertise this as intended and the better way to handle global tools, which kinda makes sense I suppose. But kind of pain in this scenario.

If this ends up being a real problem, I might have to split the executable and the `series`/`parallel` exports to separate packages, or find some other similar solution to keep them more separate. Note that this isn't a problem with just `swig-cli` - this is problem across the board with globally installed npm packages (conflicts between global and project local versions).

## Explanation of Async Wrappers

The trick to this whole operation is that pipeline definitions like this:

```javascript
export const someTask = series(task1, parallel(task2, task3), task4)
```

need to pass around functions, but not execute them. And due to a lack of any easy and reliable ways to determine if a function is async (without executing it and seeing if it returned a promise), we just always assume it could be async and use `await` when executing any user-defined functions that were passed in (using `await` on a non-async function simply executes it).

So, the `series` and `parallel` methods essentially take the functions passed as params and wrap them in async wrappers to be executed later.

## Protection from Non-Typescript Silliness

Normally if you're writing typescript functions to be consumed by other typescript code, you can rely on type constraints on method signatures. But if you're writing typescript functions that are transpiled and accessed by any flavor of javascript, we need to protect ourselves more. I've added some checks to verify that params passed to series and parallel are actually `Task` or `NamedTask`. There may be additional spots in the code that need similar treatment.

## Node Breaking Change to Loaders

The NodeJS `--loader` CLI flag got yanked out from under us in a minor release (... oof). I had to add branching logic to use `--import` instead if the NodeJS version executing is >= 18.19. I'm also checking if the tsx version is less than 4 since lower versions don't recognize the `--import` flag.

I also had to change the ts-node spawn args so that node less than 18.19 uses the old way and greater than that uses `--experimental-loader`, which is just a temporary thing since they'll probably remove that at some point. Hopefully by then they'll have figured out what to do about esm support... In the meantime, node greater than or equal to 18.19 also needs to have the tsconfig.json setting for type check skipping since we can't pass the `-T` flag anymore:

```json
"ts-node": {
  "transpileOnly": true
}
```

This issue also makes it so I can't support mixed esm/cjs syntax in a typescript file, but that probably wasn't a reasonable thing to try and support anyway.

## Pnpm Notes

I've started using [pnpm](https://pnpm.io/installation). It seems to work ok with volta so far, but keep an eye on this (there are a lot of complaints in the volta github issues).

Install steps:
- Add system environment variable: VOLTA_FEATURE_PNPM=1
- Run `volta install pnpm`

Some advantages of using pnpm:

- Saves disk space (re-uses existing versions of npm packages)
- Way faster to install or update if the versions of packages involved are already on the machine

Pnpm store location: `%localappdata%\pnpm\store\v3`

The advertisement is that "sym links are used to save space". However, it's a little more involved than that (at least on Windows). There are "regular" symbolic links pointing each package dir in node_modules to a directory with the same name in node_modules/.pnpm, but the files there ... aren't actually there (sort of). They are "hard links" and there's no indicator at all for this in any built-in windows UI, so you'd have to use something like fsutil to actually see that. But essentially the hard link enables many "files" to point to the same actual space on disk, and the space on disk isn't actually deleted until all the "pointers" (files) that are hard linked are deleted.

I originally thought that my shortcuts to access files directly in node_modules would break with pnpm, but pnpm's strategy to mimic the original npm node_modules allows my shortcuts to work normally.

## Swig Inception Notes

Originally I didn't intend to use swig to orchestrate the swig project's own dev tasks. I thought I would possibly run into strange issues with version ambiguity or other conflicts. However, now that swig is more stable, I've migrated from using npm scripts and the loose `tasks` file to using a live version of swig. To ensure there are as few issues as possible, this is how I plan on using this scenario:

- When developing swig, uninstall global version of swig-cli to avoid possible conflicts or ambiguity: volta uninstall swig-cli
- Call swig with ".\swig.ps1" instead of "npx swig" in order to skip the npx delay
- After done, re-install global version of swig-cli: volta install swig-cli@latest

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
