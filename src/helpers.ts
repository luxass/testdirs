/**
 * Helper functions for creating and working with test directories.
 * @module helpers
 *
 * @example
 * ```ts
 * import { isSymlink } from "testdirs/helpers";
 *
 * const files = {
 *   "test.txt": "Hello, World!",
 *   "symlink.txt": symlink("test.txt"),
 * }
 *
 * if (isSymlink(files["test.txt"])) {
 *   console.log("test.txt is a symlink");
 * }
 *
 * if (isSymlink(files["symlink.txt"])) {
 *   console.log("symlink.txt is a symlink");
 * }
 *
 * // -> symlink.txt is a symlink
 * ```
 *
 * @example
 * ```ts
 * import { metadata, hasMetadata } from "testdirs/helpers";
 *
 * const files = {
 *   "test.txt": "Hello, World!",
 *   "readonly.txt": metadata("Hello, World!", { mode: 0o444 }), // read-only file
 * }
 *
 * if (hasMetadata(files["readonly.txt"])) {
 *   console.log("readonly.txt is read-only");
 * }
 *
 */

import type {
  DirectoryContent,
  DirectoryJSON,
  FSMetadata,
  TestdirLink,
  TestdirMetadata,
  TestdirSymlink,
} from "./types";
import { readdir } from "node:fs/promises";
import { platform } from "node:os";
import { basename, join, normalize } from "node:path";
import {
  FIXTURE_METADATA_SYMBOL,
  FIXTURE_TYPE_LINK_SYMBOL,
  FIXTURE_TYPE_SYMLINK_SYMBOL,
} from "./constants";

/**
 * Create a symlink to a file or directory
 * @param {string} path The path to link to
 * @returns {TestdirSymlink} A TestdirSymlink object
 */
export function symlink(path: string): TestdirSymlink {
  return {
    [FIXTURE_TYPE_SYMLINK_SYMBOL]: FIXTURE_TYPE_SYMLINK_SYMBOL,
    path: normalize(path),
  };
}

/**
 * Check if value is a TestdirSymlink
 * @param {unknown} value The value to check
 * @returns {value is TestdirSymlink} The same value
 */
export function isSymlink(value: unknown): value is TestdirSymlink {
  return (
    typeof value === "object"
    && value !== null
    && (value as TestdirSymlink)[FIXTURE_TYPE_SYMLINK_SYMBOL]
    === FIXTURE_TYPE_SYMLINK_SYMBOL
  );
}

/**
 * Create a link to a file or directory
 * @param {string} path The path to link to
 * @returns {TestdirLink} A TestdirLink object
 */
export function link(path: string): TestdirLink {
  return {
    [FIXTURE_TYPE_LINK_SYMBOL]: FIXTURE_TYPE_LINK_SYMBOL,
    path: normalize(path),
  };
}

/**
 * Check if value is a TestdirLink
 * @param {unknown} value The value to check
 * @returns {value is TestdirLink} The same value
 */
export function isLink(value: unknown): value is TestdirLink {
  return (
    typeof value === "object"
    && value !== null
    && (value as TestdirLink)[FIXTURE_TYPE_LINK_SYMBOL]
    === FIXTURE_TYPE_LINK_SYMBOL
  );
}

/**
 * Combines directory JSON with metadata to create a TestdirMetadata object.
 *
 * @param {DirectoryContent} content - The content you want to add metadata to
 * @param {FSMetadata} metadata - The FSMetadata object containing file system metadata
 * @returns {TestdirMetadata} A TestdirMetadata object containing both the directory structure and metadata
 *
 * @remarks
 * due to how permissions work on windows and `libuv` doesn't support windows acl's.
 * setting a directory to readonly on windows doesn't actually work, and will still be writable.
 */
export function metadata(content: DirectoryContent | DirectoryJSON, metadata: FSMetadata): TestdirMetadata {
  return {
    [FIXTURE_METADATA_SYMBOL]: metadata,
    content,
  };
}

/**
 * Check if value is a TestdirMetadata
 * @param {unknown} value The value to check
 * @returns {value is TestdirMetadata} The same value
 */
export function hasMetadata(value: unknown): value is TestdirMetadata {
  return (
    typeof value === "object"
    && value !== null
    && (value as TestdirMetadata)[FIXTURE_METADATA_SYMBOL] != null
  );
}

/**
 * Checks if the given data is a primitive value.
 *
 * @param {unknown} data - The data to be checked.
 * @returns {data is Exclude<DirectoryContent, TestdirSymlink | TestdirLink | DirectoryJSON | TestdirMetadata>} `true` if the data is a primitive value, `false` otherwise.
 */
export function isPrimitive(data: unknown): data is Exclude<DirectoryContent, TestdirSymlink | TestdirLink | DirectoryJSON | TestdirMetadata> {
  return (
    typeof data === "string"
    || typeof data === "number"
    || typeof data === "boolean"
    || data === null
    || data === undefined
    || typeof data === "bigint"
    || typeof data === "symbol"
    || data instanceof Uint8Array
  );
}

/**
 * Capture a snapshot of a directory tree structure as a tree-view string
 * @param {string} path The directory path to capture
 * @returns {Promise<string>} Tree-view representation of the directory structure
 */
export async function captureSnapshot(path: string): Promise<string> {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });

  // pre calculate normalized base path
  const normalizedBasePath = normalize(path.replace(/[/\\]$/, ""));
  const basePathLength = normalizedBasePath.length;

  const tree = new Map<string, Array<{ name: string; isDir: boolean }>>();

  for (const entry of entries) {
    const fullPath = normalize(join(entry.parentPath || "", entry.name));
    const relativePath = fullPath.slice(basePathLength + 1);

    const lastSlashIndex = relativePath.lastIndexOf("/");
    const parentDir = lastSlashIndex === -1 ? "" : relativePath.slice(0, lastSlashIndex);

    let children = tree.get(parentDir);
    if (!children) {
      children = [];
      tree.set(parentDir, children);
    }

    children.push({
      name: entry.name,
      isDir: entry.isDirectory(),
    });
  }

  // sort all children arrays by directory first, then files
  for (const children of tree.values()) {
    children.sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }

  const result: string[] = [`${basename(path)}/`];

  // for debug only
  if (platform() === "win32") {
    console.error("MAP:", Object.fromEntries(tree));
  }

  function renderTree(dirPath: string, prefix: string): void {
    const children = tree.get(dirPath);

    // return early, if there isn't any children.
    if (!children) return;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isLast = i === children.length - 1;

      const connector = isLast ? "└── " : "├── ";
      const childName = child.isDir ? `${child.name}/` : child.name;

      result.push(prefix + connector + childName);

      if (child.isDir) {
        const childPath = dirPath ? `${dirPath}/${child.name}` : child.name;
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        renderTree(childPath, newPrefix);
      }
    }
  }

  renderTree("", "");

  return result.join("\n");
}
