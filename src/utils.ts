import type { DirectoryJSON, FromFileSystemOptions } from "./types";
import { readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { readdir, readFile, readlink, stat } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import {
  FIXTURE_ORIGINAL_PATH_SYMBOL,
} from "./constants";
import { symlink } from "./helpers";

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
    const result = await stat(path);
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

  const dirFiles = await readdir(path, {
    withFileTypes: true,
  });

  const filteredFiles = dirFiles.filter((file) => !options.ignore.includes(file.name));

  for (const file of filteredFiles) {
    const filePath = file.name;
    const fullPath = `${path}/${filePath}`;

    if (file.isDirectory()) {
      files[filePath] = await processDirectory(fullPath, options);
    } else if (options.followLinks && file.isSymbolicLink()) {
      files[filePath] = symlink(await readlink(fullPath));
    } else {
      files[filePath] = await readFile(fullPath, options.getEncodingForFile(fullPath));
    }
  }

  return files;
}
