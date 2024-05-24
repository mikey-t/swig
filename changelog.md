# swig-cli Change Log

## 2024-05-24 - Version 1.0.3

- Fixed a bug introduced by switching to rollup where nested `series` and `parallel` calls were being logged as "anonymous" instead of `nested_series_#` and `nested_parallel_#`.
- Set Node.js version to 20.13.1 and updated dev dependency versions.
