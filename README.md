# testdirs

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![jsr version][jsr-version-src]][jsr-version-href]

A utility to create isolated test directories

> [!NOTE]
> If you want to use this package with Vitest, we recommend using the [vitest-testdirs](https://github.com/luxass/vitest-testdirs) with added support for Vitest.

## 📦 Installation

```bash
npm install testdirs --save-dev
```

## 🚀 Usage

```ts
import type { TestdirOptions } from "testdirs";
import { testdir } from "testdirs";

const testdirOptions = {
  dirname: "testdir", // default: a random directory name
} satisfies TestdirOptions;

const dir = await testdir({
  "file1.txt": "Hello, World!",
  "nested": {
    "file2.txt": "Hello, Nested!",
    "tests": {
      "file3.txt": "Hello, Tests!"
    }
  },

  // Alternatively, you can create nested directories with a flat path
  "nested/tests/file4.txt": "Hello, Tests!"
}, testdirOptions);

console.log(dir.path);

// you need to handle the removal process yourself!
await dir.remove();
```

> [!NOTE]
> There is also a sync version available through the `testdir/sync` import.

### Different Types of Files

You can create different types of files using the following methods:

```ts
import type { TestdirOptions } from "testdirs";
import { link, metadata, symlink, testdir } from "testdirs";

const dir = await testdir({
  "file1.txt": "Hello, World!",

  "nested": {
    "file2.txt": symlink("../file1.txt"),
    "file3.txt": metadata("Hello, World!", { mode: 0o444 }), // read-only file
  },

  "readonly": metadata({
    "file4.txt": "Hello, World!",
  }, { mode: 0o444 }), // read-only directory

  // creating a symlink pointing to file1.txt
  "symlink.txt": symlink("file1.txt"),
  "symlink2.txt": symlink("nested/file2.txt"),
  "link.txt": link("file1.txt"),
});
```

### Create testdir from existing directory

You can create a testdir from an existing directory using the `from` method:

```ts
import type { FromFileSystemOptions, TestdirOptions, TestdirSyncFromOptions } from "testdirs";
import assert from "node:assert";
import { fromFileSystem, testdir } from "testdirs";

const fromFSOptions = {
  ignore: [".git"], // ignore everything inside the .git directory
  followLinks: false, // don't follow symlinks
  extras: {}, // extra files to add to the files object
  getEncodingForFile: (file) => "utf-8", // get the encoding for the file (default: utf-8)
} satisfies FromFileSystemOptions;

const dir = await testdir.from("path/to/existing/directory", {
  dirname: "testdir", // default: a random directory name
  fromFS: fromFSOptions,
});

// Alternatively, you can also use the `fromFileSystem` method to create the files object from the file system
const files = await fromFileSystem("path/to/existing/directory", fromFSOptions);

assert(files["file1.txt"] === "Hello, World!");

const testdirOptions = {
  dirname: "testdir", // default: a random directory name
} satisfies TestdirOptions;

const dir = await testdir(files, testdirOptions);
```

## 📄 License

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/testdirs?style=flat&colorA=18181B&colorB=4169E1
[npm-version-href]: https://npmjs.com/package/testdirs
[npm-downloads-src]: https://img.shields.io/npm/dm/testdirs?style=flat&colorA=18181B&colorB=4169E1
[npm-downloads-href]: https://npmjs.com/package/testdirs
[jsr-version-src]: https://jsr.io/badges/@luxass/testdirs?style=flat&labelColor=18181B&logoColor=4169E1
[jsr-version-href]: https://jsr.io/@luxass/testdirs
