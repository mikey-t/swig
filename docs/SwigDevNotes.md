# Swig Dev Notes

This doc is for misc dev notes about how to setup and develop the project, issues and gotchas, decisions made, future plans, etc.

## Why Swig Instead of Gulp

Some contributing factors that led me to create swig:

- Security warnings in gulp
- Gulp codebase seems less well-maintained than in the past
- Gulp documentation is partially out of date
- The size of gulp and the depth of it's dependency tree. Running `npx howfat@latest gulp` tells me it has approximately 3489 files, 459 transitive dependencies and 9.6MB.
- The complexity of gulp:
  - Gulp has a lot of opinionated filesystem manipulation, but the built-in NodeJS library `fs` has everything I need
  - I just need some very basic glue - I don't want all the opinionated error handling logic
  - I don't need an entire plugin architecture - I'm just gluing other things together (often by simply spawning other processes)
  - I don't need my collection of dev automation tasks to be runnable by CI - I just need a spot to automate all my local dev tasks (though there's nothing stopping swig from evolving into something that could be utilized by CI/CD)
  - I don't need tools like a custom file watcher built into my task runner (if I need a file watcher, it can easily be separate from my task runner)
- I want to have more control over how it works (see swig named tasks, for example)
- I want easier setup with various different javascript and typescript flavors
- "Gulp" is hard to type...

## Startup Wrapper Script

There's some magic here that allows a lot of flexibility without the user really having to do much or know much about what's happening under the hood (or passing additional parameters, etc). In my first attempt at swig I had 2 executables: one for esm and one for cjs. And I forced the consumer to know which they should use and had lots of instructions in the readme about it. On top of that there were yet more instructions for typescript and there were all sorts of gotchas and scenarios that didn't quite work right.

The `SwigStartupWrapper` is the solution to all of these types of problems. Now there is only one executable, and in that startup logic it systematically checks things to make sure it'll work and it conditionally chooses the right combo of scripts to run, and whether to run ts-node or ts-node-esm if a typescript swigfile is present. Rather than continuing in the same startup process (that is always initially ESM), it spawns a new child process with whatever is needed, thus bypassing the need to explain all these scenarios to the user.

There are some potential risks to the current implementation of this startup script (see the TODO section below), but so far I haven't had any issues and this provides an excellent user experience.

In addition to providing flexibility, the startup script also accidentally fixed an issue where running with an npm alias or npx was causing dash parameters to be hijacked by npm/npx. Which could really add a lot of confusion and headache for when consumers start defining tasks that evaluate process.argv for additional options (these were previously broken when running via npm). Instead, the new process getting spawned is calling node directly, so npm/npx has no chance to break things.

## Rapid Dev Loop Using Example Project

Setup:

- In root of project, run (and leave running): `.\swig.ps1 watchEsm`
- Ensure project references the main directory for swig-cli (if it doesn't already). In example project in another terminal, remove swig-cli and re-add it using the relative location:
    - `pnpm rm swig-cli`
    - `pnpm i -D ../../`

Clean up:
- Stop the process running the `watchEsm` task with ctrl + C
- Clean up all example projects (if references were changed) by running: `.\swig.ps1 updateExamples`

Note that unit tests rely on existence of existing tasks in swigfiles in example projects, so those must remain intact and unmodified (unless unit tests are also updated.)

## Why the CJS version?

It turns out you can get around the fact that ESM can't dynamically import a typescript file by using commonjs instead (which it can do, surprisingly). This is how I'm getting away with not transpiling the typescript swigfile before importing it - I'm just using the CJS version of swig for this scenario. Sneaky. But may want to look into a more robust solution in case this doesn't work out in some scenarios.

This is a little confusing because when I'm calling ts-node, it's not on a .ts file, so it goes like this:

swig -> SwigStartupWrapper -> node spawn child process -> Swig.cjs -> imports swigfile.ts dynamically

So the entry is always ESM, but really it's a combination of ts-node and the cjs version of the script that enables the dynamic typescript file import. There might be other better ways to do this - I'll look into it.

Note that this doesn't apply to tsx, which currently doesn't work well when dynicamlly importing a commonjs typescript file (main readme points out that the commonjs/typescript mixed esm/cjs syntax scenario needs ts-node over tsx).

## Volta Gotcha with Global Node CLI

I'm using Volta for managing node/npm on my machine - you can ignore this if you don't use Volta.

If you install a new version of `swig-cli` globally with `volta install swig-cli@latest`, it will correctly get the new version and install it, but if you run `swig` with this new version in a directory of a project that has an older version of `swig-cli` installed (so it's swigfile can import `series`/`parallel`), it will use the older version in the project-local node_modules. The volta folks advertise this as intended and the better way to handle global tools, which kinda makes sense I suppose. But it has the potential to be a pain in this particular scenario.

If this ends up being a real problem, I might have to split the executable and the `series`/`parallel` exports to separate packages, or find some other similar solution to keep them more separate. Note that this isn't a problem with just `swig-cli` - this is problem across the board with globally installed npm packages (conflicts between global and project local versions).

## Explanation of Async Wrappers

The trick to this whole operation is that pipeline definitions like this:

```javascript
export const someTask = series(task1, parallel(task2, task3), task4)
```

need to pass around functions, but not execute them. And due to a lack of any easy and reliable ways to determine if a function is async at runtime (without executing it and seeing if it returned a promise), we just always assume it could be async and use `await` when executing any user-defined functions that were passed in (using `await` on a non-async function simply executes it normally).

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

This particular issue shined a spotlight on how important the SwigStartupWrapper is. It's the perfect location for this type of conditional logic to ensure swig works in as many scenarios as possible without the user to take any action.

## Pnpm Notes

I've started using [pnpm](https://pnpm.io/installation). It seems to work ok with volta so far, but keep an eye on this (there are a lot of complaints in the volta github issues).

Install steps:
- Add system environment variable: VOLTA_FEATURE_PNPM=1
- Run `volta install pnpm`

Some advantages of using pnpm:

- Saves disk space (re-uses existing versions of npm packages)
- Way faster to install or update if the versions of packages involved are already on the machine
- The speed of install is especially important for my testing of other node versions (rapidly re-install dependencies in many example projects without downloading anything)

Pnpm store location: `%localappdata%\pnpm\store\v3`

The advertisement is that "sym links are used to save space". However, it's a little more involved than that (at least on Windows). There are "regular" symbolic links pointing each package dir in node_modules to a directory with the same name in node_modules/.pnpm, but the files there ... aren't actually there (sort of). They are "hard links" and there's no indicator at all for this in any built-in windows UI, so you'd have to use something like fsutil to actually see that. But essentially the hard link enables many "files" to point to the same actual space on disk, and the space on disk isn't actually deleted until all the "pointers" (files) that are hard linked are deleted.

I originally thought that my shortcuts to access files directly in node_modules would break with pnpm, but pnpm's strategy to mimic the original npm node_modules allows my shortcuts to work normally.

## Swig Inception Notes

Originally I didn't intend to use swig to orchestrate the swig project's own dev tasks. I thought I would possibly run into strange issues with version ambiguity or other conflicts. However, now that swig is more stable, I've migrated from using npm scripts and the loose `tasks` file to using a "live" version of swig (referencing node_modules directly). To ensure there are as few issues as possible, this is how I plan on using this scenario:

- When developing swig, uninstall global version of swig-cli to avoid possible conflicts or ambiguity: volta uninstall swig-cli
- Call swig with ".\swig.ps1" instead of "npx swig" in order to skip the npx delay
- After done, re-install global version of swig-cli: volta install swig-cli@latest

## Testing Notes

There are 2 "modes" for testing:
- Direct testing that uses examples directory in this project
- Testing of specific Node version, accomplished by copying examples to a temp directory, pinning Node version using volta and running using volta shim

Normally the "direct" method can be used while developing, and then the full suite of tests can be run before pushing a new release.

Relevant swig tasks for testing:

```text
test
testNodeVersion <node_version> // See swigfile.ts -> nodeTestVersionsImmutable
testAllNodeVersions
```

Pass `skip` to `testNodeVersion` and `testAllNodeVersions` to skip the prep step (copying files, pnpm install, switching of swig-cli reference).

Pass `o` to any of the test commands to only execute tests marked with "only".

Note that error code 126 is what's being checked for instead of 1 when running the Node version specific tests. This is due to calling volta directly and volta has it's own set of custom return codes (see https://github.com/volta-cli/volta/blob/9beb67be17295aa3da8edef8633f8534d56bed90/crates/volta-core/src/error/mod.rs).

Note that when tests execute, it's tsx with latest project-root Node version, but that these tests are spawning new processes where a different Node version can be used in the case of the Node version specific tests. In these cases volta is called directly (using `volta run node ...`) so that the package.json volta section Node version is respected. You can verify that it's actually using the expected version of Node by adding some logging statements to one of the example project swigfiles (i.e. `console.log(process.version)`), ensure Swig.test.ts variable `logAllTaskResults` is set to `true`, then run `.\swig.ps1 testNodeVersion <node_version_here>`.

To test a subset of the example projects, update Swig.test.ts variable `projectsToTestOverride` with the specific projects to test. Be sure to put this back before committing.

## Testing Packed Version

Keep in mind that pnpm will not pull in an updated version without the `--force` flag, which I'm using in the swigfile tasks that remove and re-add the swig-cli dependency in example/test projects. I could alternatively use a strategy where after a change I bump a package.json suffix like `-alpha<number>` and re-test. However, the pnpm `--force` options seems to be good enough for my use case.

## Errors Deleting node_modules

I started getting intermittent errors when running any swig task that needs to delete a node_modules directory. It's complaining about a file handle on `esbuild.exe`. It's unclear why this so frequently has a lingering handle that prevents deletion. I tried adding a couple sleeps around node_modules deletion in addition to setting the `maxRetries` to 5, but it still happens.

The workaround for now is to just re-run whatever the task was. If it persists, I've found that the most likely culprit is vscode, so closing that seems to free up whatever the handle is. There's a TODO item below to investigate this.

## TODO

- Determine if there's a better alternative to accessing node_modules directly (see section below)
- Provide way of overriding functionality via a config file like `.swig.json`
    - Override ts-node paths
    - Set alternate swigfile location
    - Suppress warnings from startup checks (such as for dual typescript/non-typescript swigfile where consumer is doing their own transpilation)
- Testing
  - Troubleshoot issue with intermittent deletion failure due to file handle on esbuild.exe within node_modules. It's unclear what process is not releasing it's lock on that file fast enough (probably tsx from a previous spawn call?) - it seems to always work on the second try after this error happens. I'll need to create a simpler example method that repeats in a loop for greater chance of repro, then perhaps dynamically log process owner in code since it doesn't stick around long enough to check after the fact. Might also have something to do with pnpm instead of npm and windows hard links. Not my first choice, but I could try adding a delay in before each deletion of any node_modules directory.
  - Add additional tests:
    - Tests that verify various error/warning messages for syntax mismatches
    - Tests that verify exported classes are not considered runnable swig tasks (currently there's a bug causing some project/syntax combos to still do this - add some tests while fixing the bug)
  - Speed up tests by splitting each example project's tests into separate files to take advantage of the test runner's parallel execution

## TODO - address direct node_modules access issue

The new wrapper script makes swig significantly easier to use, but it is using direct paths to local node_modules for both ts-node and swig, which is probably not great for a few reasons. I'd like to look into using a different strategy.

Some things to keep in mind that I wouldn't want to lose if I were to switch strategies:

- **Speed**. Calling the scripts directly instead of running through npm/npx is significantly faster.
- **Versatility**. The startup script allows for dynamically and automatically adjusting to many or even all variables (node version, swigfile type, project type, etc).
- **Ease of setup**. No need to add an npm alias or call any additional params to register a transpiler - it just works.
- **Auto-documentation**.
    - If the consumer doesn't have tsx or ts-node installed, it will give them a friendly message that it's needed and what command to run
    - If the consumer is using a global install of swig but forgot to install it in their local project so they can import `series` and `parallel` into their swigfile, it'll give them a friendly message with the necessary command
    - If they've got a mismatch in their task definition file syntax and the package.json type, it tells them what to change (file extension vs package.json vs task file syntax change)

So, what if the a path to swig or ts-node or tsx changes? We can add branching logic in the startup wrapper - that's kind of what it's for anyway - but that could become a maintenance issue over time. Whether I get serious about diverging from this strategy will depend on how often (if ever) ts-node or tsx changes their bin path and whether I want to take the hit of adding additional dependencies or additional custom code to resolve paths instead of hitting them directly.

UPDATE: perhaps I could rely on the existence of `./node_modules/.bin/ts-node` to determine whether it's installed as a dependency. That file being there means it's installed, and parsing that file would make it pretty easy to find the executable. Seems a little hacky maybe, but as long as there's logging to say what path was chosen and why, that seems like a reasonable compromise IMO. Test by moving my swig executable location locally and verifying that it can still be found with the new "script finder" logic.
