import type { DirectoryJSON, FromFileSystemOptions } from "./types";
import fsAsync from "node:fs/promises";
import path, { resolve } from "node:path";
import {
  FIXTURE_METADATA_SYMBOL,
  FIXTURE_ORIGINAL_PATH_SYMBOL,
} from "./constants";
import {
  hasMetadata,
  isLink,
  isPrimitive,
  isSymlink,
  symlink,
} from "./helpers";

export const DEFAULT_ENCODING_FOR_FILE_FN = () => "utf-8" as BufferEncoding;

/**
 * Checks if the provided path points to a directory.
 *
 * @param {string} path - The file system path to check
 * @returns {Promise<boolean>} A promise that resolves to true if the path is a directory, false otherwise
 * @throws Never - Catches and handles any filesystem errors by returning false
 *
 * @example
 * ```ts
 * const isDir = await isDirectory("/path/to/check");
 * if (isDir) {
 *   console.log("Path is a directory");
 * }
 * ```
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const result = await fsAsync.stat(path);
    return result.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Processes a directory and its contents recursively, creating a JSON representation of the file system.
 *
 * @param {string} path - The absolute path to the directory to process
 * @param {Required<Omit<FromFileSystemOptions, "extras">>} options - Configuration options for processing the directory
 *
 * @returns {Promise<DirectoryJSON>} A Promise that resolves to a DirectoryJSON object representing the directory structure
 *          where keys are file/directory names and values are either:
 *          - A string containing file contents for regular files
 *          - A DirectoryJSON object for subdirectories
 *          - A symbolic link representation for symlinks (when followLinks is true)
 *
 * @throws {Error} If there are issues reading the directory or its contents
 */
export async function processDirectory(
  path: string,
  options: Required<Omit<FromFileSystemOptions, "extras">>,
): Promise<DirectoryJSON> {
  const files: DirectoryJSON = {
    [FIXTURE_ORIGINAL_PATH_SYMBOL]: resolve(path),
  };

  const dirFiles = await fsAsync.readdir(path, {
    withFileTypes: true,
  });

  const filteredFiles = dirFiles.filter((file) => !options.ignore.includes(file.name));

  for (const file of filteredFiles) {
    const filePath = file.name;
    const fullPath = `${path}/${filePath}`;

    if (file.isDirectory()) {
      files[filePath] = await processDirectory(fullPath, options);
    } else if (options.followLinks && file.isSymbolicLink()) {
      files[filePath] = symlink(await fsAsync.readlink(fullPath));
    } else {
      files[filePath] = await fsAsync.readFile(fullPath, options.getEncodingForFile(fullPath));
    }
  }

  return files;
}

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
        await isDirectory(path.resolve(path.dirname(filename), data.path))
          ? "junction"
          : "file",
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
