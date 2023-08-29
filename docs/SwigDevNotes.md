# Swig Dev Notes

This doc is for misc dev notes about how to setup and use project, issues and gotchas, decisions made, future plans, etc.

## Rapid `swig-cli.ts` Dev Loop

Setup:

- In project root: `npm link`. This installs it globally (referencing your local files) which gives you the executables in global context (`swig` and `swig-cjs`) and allows the `npm link swig-cli` command below to also use your local files instead of looking for the package in real npm registry.
- In example dir:
    - `npm rm swig-cli`
    - `npm link swig-cli`. Nothing will show up in package.json, but it's referenced and will work. To see currently lined packages, run `npm ls --link=true`
- Now you can run commands in the example project dir to test using the global executable (e.g. `swig ls` instead of `npm run swig ls`). This works because of the link command in the root of the project.

Clean up:
- In example dir:
    - `npm rm swig-cli`
- In project root:
    - `npm unlink`
    - `npm run updateExamplesAndTest` (builds, packs and updates references in all example projects to packed version)

## Misc Old Package.json Stuff

Reminder to setup better way of quickly testing individual examples, such as with taking additional params. Perhaps wait until I replace tasks.cjs with something more permanent.

```
"updateEsmAndSmokeTest": "node tasks.cjs cleanDist && npm run build:esm && npm run pack && node tasks.cjs updateEsmExampleDependency && node tasks.cjs smokeTestEsm",
"updateCjsAndSmokeTest": "node tasks.cjs cleanDist && npm run build:cjs && npm run pack && node tasks.cjs updateCjsExampleDependency && node tasks.cjs smokeTestCjs",
"updateTsAndSmokeTest": "node tasks.cjs cleanDist && npm run build:cjs && npm run pack && node tasks.cjs updateTsExampleDependency && node tasks.cjs smokeTestTs",
"smokeTestEsm": "node tasks.cjs smokeTestEsm",
"smokeTestCjs": "node tasks.cjs smokeTestCjs",
"smokeTestTs": "node tasks.cjs smokeTestTs"
```

## TODO

- Come back and make the automated tasks for this project better (maybe wire up swig to test swig!?)
- Setup unit testing (integration testing really) and add tests (see notes for list of needed tests I've kept track of so far)
- Test with different versions of NodeJS
- Research options for automatically transpiling a typescript swigfile - maybe even conditionally depending on whether there's changes - that'd be neat
