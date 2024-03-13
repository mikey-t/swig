Swig-cli example projects are named for their project type first (package.json `type` field of either `commonjs` for CommonJS or `module` for ESM), followed by other conditions (such as swigfile syntax or file extension, ts-node vs tsx, etc).

Examples are used for integration testing, so remember to update tests if swigfiles in any of the examples are updated.

Before running tests, ensure example projects are updated first:

- `.\swig.ps1 updateExamples`
- `.\swig.ps1 test`

