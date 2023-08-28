# Swig Dev Notes

## Rapid `swig-cli.ts` Dev Loop

Setup:

- In project root: `npm link`. This installs it globally (referencing your local files) which gives you the executables in global context (`swig` and `swig-cjs`) and allows the `npm link @mikeyt23/swig` command below to also use your local files instead of looking for the package in real npm registry.
- In example dir:
    - `npm rm @mikeyt23/swig`
    - `npm link @mikeyt23/swig`. Nothing will show up in package.json, but it's referenced and will work. To see currently lined packages, run `npm ls --link=true`
- Now you can run commands in the example project dir to test using the global executable (e.g. `swig ls` instead of `npm run swig ls`). This works because of the link command in the root of the project.

Clean up:
- In example dir:
    - `npm rm @mikeyt23/swig`
- In project root:
    - `npm unlink`
    - `npm run updateExamplesAndTest` (builds, packs and updates references in all example projects to packed version)

## Misc Old Package.json Stuff

```
"updateEsmAndSmokeTest": "node tasks.cjs cleanDist && npm run build:esm && npm run pack && node tasks.cjs updateEsmExampleDependency && node tasks.cjs smokeTestEsm",
"updateCjsAndSmokeTest": "node tasks.cjs cleanDist && npm run build:cjs && npm run pack && node tasks.cjs updateCjsExampleDependency && node tasks.cjs smokeTestCjs",
"updateTsAndSmokeTest": "node tasks.cjs cleanDist && npm run build:cjs && npm run pack && node tasks.cjs updateTsExampleDependency && node tasks.cjs smokeTestTs",
"smokeTestEsm": "node tasks.cjs smokeTestEsm",
"smokeTestCjs": "node tasks.cjs smokeTestCjs",
"smokeTestTs": "node tasks.cjs smokeTestTs"
```