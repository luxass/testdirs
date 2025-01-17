import type { DirectoryJSON, FromFileSystemOptions, TestdirFromOptions, TestdirOptions } from "./types";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsAsync from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FIXTURE_METADATA_SYMBOL, FIXTURE_ORIGINAL_PATH_SYMBOL } from "./constants";
import { hasMetadata, isLink, isPrimitive, isSymlink } from "./helpers";
import { DEFAULT_ENCODING_FOR_FILE_FN, isDirectory, processDirectory } from "./utils";

export interface TestdirResult {
  path: string;
  rm: () => Promise<void>;
  [Symbol.asyncDispose]: () => Promise<void>;
}

export interface TestdirFn {
  (files: DirectoryJSON, options?: TestdirOptions): Promise<TestdirResult>;
  from: (fsPath: string, options?: TestdirFromOptions) => Promise<TestdirResult>;
}

export const testdir: TestdirFn = async function testdir(
  files: DirectoryJSON,
  options?: TestdirOptions,
): Promise<TestdirResult> {
  const resolvedTemporaryDirectory = options?.dirname
    ? path.resolve(options.dirname)
    : fs.realpathSync(tmpdir());

  const fixturePath = path.join(resolvedTemporaryDirectory, `testdirs-${randomUUID()}`);

  await fsAsync.mkdir(fixturePath, {
    recursive: true,
  });

  await createFileTree(fixturePath, files);

  return {
    path: fixturePath,
    rm: async () => {
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
};

testdir.from = async (fsPath: string, options?: TestdirFromOptions) => {
  return testdir(await fromFileSystem(fsPath, {
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
 * @param {DirectoryJSON} files - An object representing the directory structure and file contents of the tree.
 */
export async function createFileTree(
  filePath: string,
  files: DirectoryJSON,
): Promise<void> {
  for (let filename in files) {
    const originalFileName = filename;
    let data = files[filename];
    const metadata = hasMetadata(data) ? data[FIXTURE_METADATA_SYMBOL] : undefined;
    data = hasMetadata(data) ? data.content : data;

    filename = path.resolve(filePath, filename);

    // check if file is a object with the link symbol
    if (isLink(data)) {
      await fsAsync.link(path.resolve(path.dirname(filename), data.path), filename);
      continue;
    }

    if (isSymlink(data)) {
      if (files[FIXTURE_ORIGINAL_PATH_SYMBOL] != null) {
        const original = path.resolve(path.normalize(files[FIXTURE_ORIGINAL_PATH_SYMBOL]));
        data.path = path.relative(path.dirname(filename), path.join(original, originalFileName));
      }

      await fsAsync.symlink(
        path.normalize(data.path),
        filename,
        await isDirectory(filename) ? "junction" : "file",
      );
      continue;
    }

    if (isPrimitive(data) || data instanceof Uint8Array) {
      const dir = path.dirname(filename);

      await fsAsync.mkdir(dir, {
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

      await fsAsync.writeFile(filename, data, {
        ...metadata,
      });
    } else {
      await fsAsync.mkdir(filename, {
        recursive: true,
        ...(metadata?.mode ? { mode: metadata.mode } : {}),
      });

      await createFileTree(filename, data as DirectoryJSON);
    }
  }
}

/**
 * Recursively reads a directory and returns a JSON representation of its structure
 *
 * @param {string} path - The path to the directory to read
 * @param {FromFileSystemOptions?} options - Options for customizing the directory reading behavior
 *
 * @returns {Promise<DirectoryJSON>} A promise that resolves to a DirectoryJSON object representing the directory structure
 * @throws Will throw an error if the path cannot be accessed or read
 *
 * @example
 * ```ts
 * const dirStructure = await fromFileSystem('./src', {
 *   ignore: ['node_modules', '.git'],
 *   followLinks: false
 * });
 * ```
 */
export async function fromFileSystem(
  path: string,
  options?: FromFileSystemOptions,
): Promise<DirectoryJSON> {
  if (!await isDirectory(path)) {
    return {};
  }

  const files = await processDirectory(path, {
    ignore: options?.ignore ?? [],
    followLinks: options?.followLinks ?? true,
    getEncodingForFile: options?.getEncodingForFile ?? DEFAULT_ENCODING_FOR_FILE_FN,
  });

  return {
    ...files,
    ...options?.extras,
  };
}
