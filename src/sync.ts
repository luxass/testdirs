/**
 * Testdirs - A utility to create a temporary directory with files and directories for testing using synchronous methods.
 * @module sync
 *
 * @example
 * ```ts
 * import { testdirSync, type TestdirOptions } from "testdirs/sync";
 *
 * const testdirOptions = {
 *   dirname: "testdir", // default: a random directory name
 * } satisfies TestdirOptions;
 *
 * const dir = testdirSync({
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
 * dir.remove();
 * ```
 *
 * @example
 * ```ts
 * import { link, metadata, symlink, testdirSync, type TestdirOptions } from "testdirs";
 *
 * const dir = testdirSync({
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
 * dir.remove();
 * ```
 *
 * @example
 * ```ts
 * import assert from "node:assert";
 * import { fromFileSystemSync, type FromFileSystemOptions, testdirSync, type TestdirOptions, type TestdirFromOptions } from "testdirs";
 *
 * const fromFSOptions = {
 *   ignore: [".git"], // ignore everything inside the .git directory
 *   followLinks: false, // don't follow symlinks
 *   extras: {}, // extra files to add to the files object
 *   getEncodingForFile: (file) => "utf-8", // get the encoding for the file (default: utf-8)
 * } satisfies FromFileSystemOptions;
 *
 * const dir = testdirSync.from("path/to/existing/directory", {
 *   dirname: "testdir", // default: a random directory name
 *   fromFS: fromFSOptions,
 * });
 *
 * // Alternatively, you can also use the `fromFileSystem` method to create the files object from the file system
 * const files = fromFileSystemSync("path/to/existing/directory", fromFSOptions);
 *
 * assert(files["file1.txt"] === "Hello, World!");
 *
 * const testdirOptions = {
 *   dirname: "testdir", // default: a random directory name
 * } satisfies TestdirOptions;
 *
 * const dir = testdirSync(files, testdirOptions);
 * ```
 */

import type { DirectoryJSON, FromFileSystemOptions, TestdirFromOptions, TestdirOptions } from "./types";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FIXTURE_METADATA_SYMBOL, FIXTURE_ORIGINAL_PATH_SYMBOL } from "./constants";
import { hasMetadata, isLink, isPrimitive, isSymlink } from "./helpers";
import { DEFAULT_ENCODING_FOR_FILE_FN, isDirectorySync, processDirectorySync } from "./utils";

export interface TestdirSyncResult {
  path: string;
  remove: () => void;
  [Symbol.dispose]: () => void;
}

export interface TestdirSyncFn {
  (files: DirectoryJSON, options?: TestdirOptions): TestdirSyncResult;
  from: (fsPath: string, options?: TestdirFromOptions) => TestdirSyncResult;
}

export const testdirSync: TestdirSyncFn = function testdirSync(
  files: DirectoryJSON,
  options?: TestdirOptions,
): TestdirSyncResult {
  const fixturePath = options?.dirname
    ? path.resolve(options.dirname)
    : path.join(fs.realpathSync(tmpdir()), `testdirs-${randomUUID()}`);

  fs.mkdirSync(fixturePath, {
    recursive: true,
  });

  createFileTreeSync(fixturePath, files);

  return {
    path: fixturePath,
    remove: () => {
      fs.rmSync(fixturePath, {
        recursive: true,
        force: true,
      });
    },
    [Symbol.dispose]: () => {
      fs.rmSync(fixturePath, {
        recursive: true,
        force: true,
      });
    },
  };
};

testdirSync.from = (fsPath: string, options?: TestdirFromOptions) => {
  return testdirSync(fromFileSystemSync(fsPath, {
    ...options?.fromFS,
  }), {
    dirname: options?.dirname,
  });
};

/**
 * Creates a file tree at the specified path using the provided files object.
 * The files object represents the directory structure and file contents of the tree.
 *
 * @param {string} filePath - The path where the file tree should be created.
 * @param {DirectoryJSON} files - The files object representing the file tree.
 */
export function createFileTreeSync(filePath: string, files: DirectoryJSON): void {
  for (let filename in files) {
    const originalFileName = filename;
    let data = files[filename];
    const metadata = hasMetadata(data) ? data[FIXTURE_METADATA_SYMBOL] : undefined;
    data = hasMetadata(data) ? data.content : data;

    filename = path.resolve(filePath, filename);

    // check if file is a object with the link symbol
    if (isLink(data)) {
      fs.linkSync(path.resolve(path.dirname(filename), data.path), filename);
      continue;
    }

    if (isSymlink(data)) {
      if (files[FIXTURE_ORIGINAL_PATH_SYMBOL] != null) {
        const original = path.resolve(path.normalize(files[FIXTURE_ORIGINAL_PATH_SYMBOL]));
        data.path = path.relative(path.dirname(filename), path.join(original, originalFileName));
      }

      fs.symlinkSync(
        data.path,
        filename,
        isDirectorySync(filename) ? "junction" : "file",
      );
      continue;
    }

    if (isPrimitive(data) || data instanceof Uint8Array) {
      const dir = path.dirname(filename);

      fs.mkdirSync(dir, {
        recursive: true,
      });

      if (
        typeof data === "number"
        || typeof data === "boolean"
        || data == null
        || typeof data === "bigint"
        || typeof data === "symbol"
      ) {
        data = String(data);
      }

      fs.writeFileSync(filename, data, {
        ...metadata,
      });
    } else {
      fs.mkdirSync(filename, {
        recursive: true,
        ...(metadata?.mode ? { mode: metadata.mode } : {}),
      });

      createFileTreeSync(filename, data as DirectoryJSON);
    }
  }
}

/**
 * Synchronously creates a DirectoryJSON object from a file system path.
 *
 * @param {string} path - The path to the directory to read
 * @param {FromFileSystemOptions?} options - Options for customizing the directory reading behavior
 *
 * @returns {DirectoryJSON} A DirectoryJSON object representing the directory structure
 * @throws Will throw an error if the path cannot be accessed or read
 *
 * @example
 * ```ts
 * const dirStructure = fromFileSystemSync('./src', {
 *   ignore: ['node_modules', '.git'],
 *   followLinks: false
 * });
 * ```
 */
export function fromFileSystemSync(
  path: string,
  options?: FromFileSystemOptions,
): DirectoryJSON {
  if (!isDirectorySync(path)) {
    return {};
  }

  const files = processDirectorySync(path, {
    ignore: options?.ignore ?? [],
    followLinks: options?.followLinks ?? true,
    getEncodingForFile: options?.getEncodingForFile ?? DEFAULT_ENCODING_FOR_FILE_FN,
  });

  return {
    ...files,
    ...options?.extras,
  };
}
