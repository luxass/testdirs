import fsAsync from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { createFileTree, fromFileSystem, testdir } from "../src";
import { link, metadata, symlink } from "../src/helpers";

const OS_TMP_DIR = os.tmpdir();

function cleanup(path: string) {
  onTestFinished(async () => {
    await fsAsync.rm(path, { recursive: true, force: true });
  });
}

async function existsAsync(path: string) {
  try {
    await fsAsync.access(path);
    return true;
  } catch {
    return false;
  }
}

describe("create testdirs", () => {
  it("should create a test directory with the specified files", async () => {
    const files = {
      "file1.txt": "content1",
      "file2.txt": "content2",
      "subdir": {
        "file3.txt": "content3",
      },
    };

    const dir = await testdir(files);

    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(
      expect.arrayContaining(["file1.txt", "file2.txt", "subdir"]),
    );
    expect(await fsAsync.readdir(path.join(dir.path, "subdir"))).toEqual(["file3.txt"]);
    expect(await fsAsync.readFile(path.join(dir.path, "file1.txt"), "utf8")).toBe("content1");
    expect(await fsAsync.readFile(path.join(dir.path, "file2.txt"), "utf8")).toBe("content2");
    expect(await fsAsync.readFile(path.join(dir.path, "subdir", "file3.txt"), "utf8")).toBe(
      "content3",
    );

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("should use random directory name if dirname is not provided", async () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = await testdir(files);
    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(["file1.txt"]);
    expect(dir.path).toContain(`${OS_TMP_DIR}/testdirs-`);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("use the provided dirname", async () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = await testdir(files, { dirname: "custom-dirname" });
    expect(await existsAsync(dir.path)).toBe(true);

    expect(dir.path).toContain(`${process.cwd()}/custom-dirname`);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("explicit resource management", async () => {
    let fixturePath: string;

    {
      await using dir = await testdir({ "file1.txt": "content1" });
      fixturePath = dir.path;
      expect(await existsAsync(fixturePath)).toBe(true);
    }

    expect(await existsAsync(fixturePath)).toBe(false);
  });

  it("create a empty directory", async () => {
    const dir = await testdir({});
    expect(await existsAsync(dir.path)).toBe(true);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("create items defined by /", async () => {
    const files = {
      "file1.txt": "content1",
      "subdir/file2.txt": "content2",
    };

    const dir = await testdir(files);
    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(
      expect.arrayContaining(["file1.txt", "subdir"]),
    );

    expect(await fsAsync.readdir(path.join(dir.path, "subdir"))).toEqual(["file2.txt"]);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("should create a test directory with with symlinks", async () => {
    const files = {
      "file1.txt": "content1",
      "file2.txt": "content2",
      "subdir": {
        "file3.txt": "content3",
        "file4.txt": link("../file1.txt"),
        "file5.txt": symlink("../file2.txt"),
      },
      "link4.txt": link("file1.txt"),
      "link5.txt": symlink("subdir/file3.txt"),
    };

    const dir = await testdir(files);

    expect(await fsAsync.readdir(dir.path)).toEqual(
      expect.arrayContaining([
        "file1.txt",
        "file2.txt",
        "link4.txt",
        "link5.txt",
        "subdir",
      ]),
    );

    expect(await fsAsync.readdir(path.join(dir.path, "subdir"))).toEqual([
      "file3.txt",
      "file4.txt",
      "file5.txt",
    ]);
    expect(await fsAsync.readFile(path.join(dir.path, "file1.txt"), "utf8")).toBe("content1");
    expect(await fsAsync.readFile(path.join(dir.path, "file2.txt"), "utf8")).toBe("content2");
    expect(await fsAsync.readFile(path.join(dir.path, "link4.txt"), "utf8")).toBe("content1");
    expect((await fsAsync.stat(path.join(dir.path, "link4.txt"))).isFile()).toBe(true);

    expect(await fsAsync.readlink(path.join(dir.path, "link5.txt"), "utf8")).toBeDefined();
    expect((await fsAsync.lstat(path.join(dir.path, "link5.txt"))).isSymbolicLink()).toBe(true);

    expect(await fsAsync.readFile(path.join(dir.path, "subdir", "file3.txt"), "utf8")).toBe(
      "content3",
    );

    expect(await fsAsync.readFile(path.join(dir.path, "subdir", "file4.txt"), "utf8")).toBe(
      "content1",
    );
    expect((await fsAsync.stat(path.join(dir.path, "subdir", "file4.txt"))).isFile()).toBe(true);

    expect(
      await fsAsync.readlink(path.join(dir.path, "subdir", "file5.txt"), "utf8"),
    ).toBeDefined();
    expect(
      (await fsAsync.lstat(path.join(dir.path, "subdir", "file5.txt"))).isSymbolicLink(),
    ).toBe(true);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("use `from` to create a test directory from a file system path", async () => {
    const dir = await testdir.from("./test/fixtures/file-system/test-dir");
    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(
      expect.arrayContaining(["file.txt", "README.md", "nested"]),
    );

    expect(await fsAsync.readdir(path.join(dir.path, "nested"))).toEqual(["README.md", "image.txt"]);

    // removing directory
    await dir.rm();
    expect(await existsAsync(dir.path)).toBe(false);
  });
});

describe("create file trees", () => {
  it("should create a file tree at the specified path", async () => {
    const dirPath = "./.testdirs/specified-path-sync";
    cleanup(dirPath);

    const files = {
      "file1.txt": "Hello, world!",
      "this/is/nested.txt": "This is a file",
      "dir1": {
        "file2.txt": "This is file 2",
        "dir2": {
          "file3.txt": "This is file 3",
        },
      },
    };

    await createFileTree(dirPath, files);

    const file1Content = await fsAsync.readFile(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file2Content = await fsAsync.readFile(path.resolve(dirPath, "dir1/file2.txt"), "utf-8");
    expect(file2Content).toBe("This is file 2");

    const file3Content = await fsAsync.readFile(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    );
    expect(file3Content).toBe("This is file 3");

    const nestedFile = await fsAsync.readdir(path.resolve(dirPath, "this/is"));
    expect(nestedFile).toEqual(["nested.txt"]);

    const nestedFileContent = await fsAsync.readFile(
      path.resolve(dirPath, "this/is/nested.txt"),
      "utf-8",
    );
    expect(nestedFileContent).toBe("This is a file");
  });

  it("should create files using primitive types", async () => {
    const dirPath = "./.testdirs/primitive-types-sync";
    cleanup(dirPath);

    const files = {
      "file1.txt": "Hello, world!",
      "file2.txt": 123,
      "file3.txt": true,
      "file4.txt": null,
      "file5.txt": undefined,
      "file6.txt": new Uint8Array([
        116,
        101,
        115,
        116,
        100,
        105,
        114,
        115,
      ]),
    };

    await createFileTree(dirPath, files);

    for (const [filename, content] of Object.entries(files)) {
      const fileContent = await fsAsync.readFile(path.resolve(dirPath, filename), "utf-8");
      if (content instanceof Uint8Array) {
        expect(fileContent).toBe("testdirs");
      } else {
        expect(fileContent).toBe(String(content));
      }
    }
  });

  it("should be able to create symlinks", async () => {
    const dirPath = "./.testdirs/with-links-sync";
    cleanup(dirPath);

    const files = {
      "file1.txt": "Hello, world!",
      "dir1": {
        "file2.txt": "This is file 2",
        "text.txt": "This is a text file",
        "dir2": {
          "file3.txt": "This is file 3",
        },
      },
      "link1.txt": symlink("dir1/text.txt"),
      "link2.txt": link("dir1/file2.txt"),
    };

    await createFileTree(dirPath, files);
    const file1Content = await fsAsync.readFile(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file2Content = await fsAsync.readFile(path.resolve(dirPath, "dir1/file2.txt"), "utf-8");

    expect(file2Content).toBe("This is file 2");

    const file3Content = await fsAsync.readFile(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    );

    expect(file3Content).toBe("This is file 3");

    const link2Content = await fsAsync.readFile(path.resolve(dirPath, "link2.txt"), "utf-8");

    expect(link2Content).toBe("This is file 2");
  });

  it.runIf(os.platform() !== "win32")("should be able to create files with different permissions", async () => {
    const dirPath = "./.testdirs/with-permissions-sync";
    cleanup(dirPath);

    const files = {
      "file1.txt": metadata("Hello, world!", { mode: 0o644 }),
      "dir1": {
        "file2.txt": metadata("This is file 2", { mode: 0o444 }),
        "dir2": metadata({
          "file3.txt": "This is file 3",
        }, { mode: 0o555 }),
      },
    };

    await expect(() => createFileTree(dirPath, files)).rejects.toThrowError("EACCES: permission denied");

    const file1Content = await fsAsync.readFile(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file1Stats = await fsAsync.stat(path.resolve(dirPath, "file1.txt"));
    expect((file1Stats.mode & 0o644).toString(8)).toBe("644");

    const file2Content = await fsAsync.readFile(
      path.resolve(dirPath, "dir1/file2.txt"),
      "utf-8",
    );
    expect(file2Content).toBe("This is file 2");

    const file2Stats = await fsAsync.stat(path.resolve(dirPath, "dir1/file2.txt"));
    expect((file2Stats.mode & 0o444).toString(8)).toBe("444");

    const dir2Stats = await fsAsync.stat(path.resolve(dirPath, "dir1/dir2"));
    expect((dir2Stats.mode & 0o555).toString(8)).toBe("555");

    // because the dir has a non writable permission, it should throw an error
    // because we can't create the file inside the dir
    await expect(() => fsAsync.readFile(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    )).rejects.toThrowError("ENOENT: no such file or directory");

    await expect(() => fsAsync.writeFile(path.resolve(dirPath, "dir1/dir2/file3.txt"), "Hello, world!")).rejects.toThrowError("EACCES: permission denied");
  });
});

describe("map fs to objects", () => {
  describe("invalid paths or directories", () => {
    it("should return an empty object if the path does not exist", async () => {
      const result = await fromFileSystem("non-existent-path");

      expect(result).toEqual({});
    });

    it("should return an empty object if the path is not a directory", async () => {
      const result = await fromFileSystem("not-a-directory");

      expect(result).toEqual({});
    });
  });

  describe("handle symlinks", () => {
    it("should correctly handle symbolic links in the directory", async () => {
      const mockFiles = {
        "file1.txt": "content1\n",
        "symlink.txt": symlink("file1.txt"),
        "symlinked-dir": symlink("nested"),
        "nested": {
          "file2.txt": "content2\n",
          "link-to-parent.txt": symlink("../file1.txt"),
          "double-nested": {
            "file3.txt": "content3\n",
            "link-to-parent.txt": symlink("../../file1.txt"),
            "double-double-nested": {
              "README.md": symlink("../../../../../../README.md"),
            },
          },
        },
      };

      const result = await fromFileSystem("./test/fixtures/symlinks");

      expect(result).toMatchObject(mockFiles);
    });

    it("should handle symbolic links using testdir", async () => {
      const files = await fromFileSystem("./test/fixtures/symlinks");

      const dir = await testdir(files);

      const rootReadme = await fsAsync.readFile("./README.md", "utf8");
      const testdirReadme = await fsAsync.readFile(`${dir.path}/nested/double-nested/double-double-nested/README.md`, "utf8");

      expect(rootReadme).toStrictEqual(testdirReadme);

      // removing directory
      await dir.rm();
      expect(await existsAsync(dir.path)).toBe(false);
    });

    it("should handle symbolic links using testdir with custom path", async () => {
      const files = await fromFileSystem("./test/fixtures/symlinks");

      const dir = await testdir(files, {
        dirname: "./three/levels/deep-sync",
      });

      const rootReadme = await fsAsync.readFile("./README.md", "utf8");
      const testdirReadme = await fsAsync.readFile(`${dir.path}/nested/double-nested/double-double-nested/README.md`, "utf8");

      expect(rootReadme).toStrictEqual(testdirReadme);

      // removing directory
      await dir.rm();
      expect(await existsAsync(dir.path)).toBe(false);
    });
  });

  describe("map file contents", () => {
    it("should return the directory structure with file contents", async () => {
      const mockFiles = {
        "file.txt": "this is just a file!\n",
        "README.md": "# testdirs\n",
        "nested": {
          "README.md": "# Nested Fixture Folder\n",
          "image.txt": "Hello, World!\n",
        },
      };

      const result = await fromFileSystem("./test/fixtures/file-system/test-dir");

      expect(result).toMatchObject(mockFiles);
    });

    it("should use different encodings when using `getEncodingForFile`", async () => {
      const mockFiles = {
        "file.txt": "this is just a file!\n",
        "README.md": "# testdirs\n",
        "nested": {
          "README.md": "# Nested Fixture Folder\n",
          // eslint-disable-next-line node/prefer-global/buffer
          "image.txt": Buffer.from([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10]),
        },
      };

      const result = await fromFileSystem("./test/fixtures/file-system/test-dir", {
        getEncodingForFile: (path) => {
          return path.endsWith("image.txt") ? null : "utf8";
        },
      });

      expect(result).toMatchObject(mockFiles);
    });
  });
});
