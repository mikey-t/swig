# swig-cli Change Log

## 2024-05-24 - Version 1.0.2

Fixed a bug introduced by switching to rollup where nested `series` and `parallel` calls were being logged as "anonymous" instead of `nested_series_#` and `nested_parallel_#`.
