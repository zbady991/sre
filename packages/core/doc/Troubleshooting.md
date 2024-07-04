Issue : Cli tests failing after a build the error says : "Cannot find package 'xyz' imported from ABC
Solution : This is usually due to typescript path aliases when they are not properly resolved by esbuild, make sure that you are not referencing any non existing or empty .ts file.

---
