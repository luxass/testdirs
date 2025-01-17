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
  rm: () => void;
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
  const resolvedTemporaryDirectory = options?.dirname
    ? path.resolve(options.dirname)
    : fs.realpathSync(tmpdir());

  const fixturePath = path.join(resolvedTemporaryDirectory, `testdirs-${randomUUID()}/`);

  fs.mkdirSync(fixturePath, {
    recursive: true,
  });

  createFileTreeSync(fixturePath, files);

  return {
    path: fixturePath,
    rm: () => {
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
        const original = path.normalize(files[FIXTURE_ORIGINAL_PATH_SYMBOL]);

        // we need to replace here due to the fact that we call `createFileTree` recursively,
        // and when we do it with a nested directory, the path is now the full path, and not just the relative path.
        const tmpPath = path.normalize(filePath.replace(
          // eslint-disable-next-line node/prefer-global/process
          `${process.cwd()}${path.sep}`,
          "",
        ));

        const pathLevels = tmpPath.split(/[/\\]/).filter(Boolean).length;
        const originalLevels = original.split(/[/\\]/).filter(Boolean).length;

        if (pathLevels < originalLevels) {
          const diff = originalLevels - pathLevels;
          data.path = data.path.replace(`..${path.sep}`.repeat(diff), "");
        } else if (pathLevels > originalLevels) {
          const diff = pathLevels - originalLevels;
          data.path = `..${path.sep}`.repeat(diff) + data.path;
        }
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
