/**
 * Testdirs - A utility to create a temporary directory with files and directories for testing.
 * @module index
 *
 * @example
 * ```ts
 * import { testdir, type TestdirOptions } from "testdirs";
 *
 * const testdirOptions = {
 *   dirname: "testdir", // default: a random directory name
 * } satisfies TestdirOptions;
 *
 * const dir = await testdir({
 *   "file1.txt": "Hello, World!",
 *   "nested": {
 *     "file2.txt": "Hello, Nested!",
 *     "tests": {
 *       "file3.txt": "Hello, Tests!"
 *     }
 *   },
 *
 *   // Alternatively, you can create nested directories with a flat path
 *   "nested/tests/file4.txt": "Hello, Tests!"
 * }, testdirOptions);
 *
 * console.log(dir.path);
 *
 * // you need to handle the removal process yourself!
 * await dir.remove();
 * ```
 *
 * @example
 * ```ts
 * import { link, metadata, symlink, testdir, type TestdirOptions } from "testdirs";
 *
 * const dir = await testdir({
 *   "file1.txt": "Hello, World!",
 *
 *   "nested": {
 *     "file2.txt": symlink("../file1.txt"),
 *     "file3.txt": metadata("Hello, World!", { mode: 0o444 }), // read-only file
 *   },
 *
 *   "readonly": metadata({
 *     "file4.txt": "Hello, World!",
 *   }, { mode: 0o444 }), // read-only directory
 *
 *   // creating a symlink pointing to file1.txt
 *   "symlink.txt": symlink("file1.txt"),
 *   "symlink2.txt": symlink("nested/file2.txt"),
 *   "link.txt": link("file1.txt"),
 * });
 *
 * console.log(dir.path);
 *
 * // you need to handle the removal process yourself!
 * await dir.remove();
 * ```
 *
 * @example
 * ```ts
 * import assert from "node:assert";
 * import { fromFileSystem, type FromFileSystemOptions, testdir, type TestdirOptions } from "testdirs";
 *
 * const fromFSOptions = {
 *   ignore: [".git"], // ignore everything inside the .git directory
 *   followLinks: false, // don't follow symlinks
 *   extras: {}, // extra files to add to the files object
 *   getEncodingForFile: (file) => "utf-8", // get the encoding for the file (default: utf-8)
 * } satisfies FromFileSystemOptions;
 *
 * const dir = await testdir.from("path/to/existing/directory", {
 *   dirname: "testdir", // default: a random directory name
 *   fromFS: fromFSOptions,
 * });
 *
 * // Alternatively, you can also use the `fromFileSystem` method to create the files object from the file system
 * const files = await fromFileSystem("path/to/existing/directory", fromFSOptions);
 *
 * assert(files["file1.txt"] === "Hello, World!");
 *
 * const testdirOptions = {
 *   dirname: "testdir", // default: a random directory name
 * } satisfies TestdirOptions;
 *
 * const dir = await testdir(files, testdirOptions);
 * ```
 */

import type { FromFileSystemOptions } from "./types";
import { randomUUID } from "node:crypto";
import fsAsync from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { createCustomTestdir } from "./factory";
import { createFileTree, fromFileSystem } from "./utils";

export {
  FIXTURE_METADATA_SYMBOL,
  FIXTURE_ORIGINAL_PATH_SYMBOL,
  FIXTURE_TYPE_LINK_SYMBOL,
  FIXTURE_TYPE_SYMLINK_SYMBOL,
} from "./constants";

export { createFileTree, fromFileSystem };

export interface TestdirResult {
  path: string;
  remove: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
}

const options = z.object({
  dirname: z.string().optional(),
});

type TestdirOptions = z.infer<typeof options>;

export const testdir = createCustomTestdir(async ({ fixturePath, files }) => {
  await fsAsync.mkdir(fixturePath, {
    recursive: true,
  });

  await createFileTree(fixturePath, files);

  return {
    path: fixturePath,
    remove: async () => {
      await fsAsync.rm(fixturePath, {
        recursive: true,
        force: true,
      });
    },
    [Symbol.asyncDispose]: async () => {
      await fsAsync.rm(fixturePath, {
        recursive: true,
        force: true,
      });
    },
  };
}, {
  async dirname(options) {
    return options?.dirname
      ? path.resolve(options.dirname)
      : path.join(await fsAsync.realpath(tmpdir()), `testdirs-${randomUUID()}`);
  },
  optionsSchema: options,
  extensions(testdir) {
    return {
      from: async (fsPath: string, options?: TestdirOptions & {
        fromFS?: FromFileSystemOptions;
      }) => {
        const files = await fromFileSystem(fsPath, options?.fromFS);
        return testdir(files, options);
      },
    };
  },
});

export type {
  CustomHookFn,
  DirectoryContent,
  DirectoryJSON,
  EncodingForFileFn,
  FactoryFn,
  FromFileSystemOptions,
  FSMetadata,
  TestdirFactoryOptions,
  TestdirFn,
  TestdirLink,
  TestdirMetadata,
  TestdirSymlink,
} from "./types";
