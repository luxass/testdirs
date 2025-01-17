import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { link, metadata, symlink } from "../src/helpers";
import { createFileTreeSync, fromFileSystemSync, testdirSync } from "../src/sync";

const OS_TMP_DIR = os.tmpdir();

function cleanup(path: string) {
  onTestFinished(() => {
    fs.rmSync(path, { recursive: true, force: true });
  });
}

describe("create testdirs", () => {
  it("should create a test directory with the specified files", () => {
    const files = {
      "file1.txt": "content1",
      "file2.txt": "content2",
      "subdir": {
        "file3.txt": "content3",
      },
    };

    const dir = testdirSync(files);

    expect(fs.existsSync(dir.path)).toBe(true);

    expect(fs.readdirSync(dir.path)).toEqual(
      expect.arrayContaining(["file1.txt", "file2.txt", "subdir"]),
    );
    expect(fs.readdirSync(path.join(dir.path, "subdir"))).toEqual(["file3.txt"]);
    expect(fs.readFileSync(path.join(dir.path, "file1.txt"), "utf8")).toBe("content1");
    expect(fs.readFileSync(path.join(dir.path, "file2.txt"), "utf8")).toBe("content2");
    expect(fs.readFileSync(path.join(dir.path, "subdir", "file3.txt"), "utf8")).toBe(
      "content3",
    );

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("should use random directory name if dirname is not provided", () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = testdirSync(files);
    expect(fs.existsSync(dir.path)).toBe(true);

    expect(fs.readdirSync(dir.path)).toEqual(["file1.txt"]);
    expect(dir.path).toContain(path.normalize(`${OS_TMP_DIR}/testdirs-`));

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("use the provided dirname", () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = testdirSync(files, { dirname: "custom-dirname" });
    expect(fs.existsSync(dir.path)).toBe(true);

    expect(dir.path).toContain(path.normalize(`${process.cwd()}/custom-dirname`));

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("explicit resource management", () => {
    let fixturePath: string;

    {
      using dir = testdirSync({ "file1.txt": "content1" });
      fixturePath = dir.path;
      expect(fs.existsSync(fixturePath)).toBe(true);
    }

    expect(fs.existsSync(fixturePath)).toBe(false);
  });

  it("create a empty directory", () => {
    const dir = testdirSync({});
    expect(fs.existsSync(dir.path)).toBe(true);

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("create items defined by /", () => {
    const files = {
      "file1.txt": "content1",
      "subdir/file2.txt": "content2",
    };

    const dir = testdirSync(files);
    expect(fs.existsSync(dir.path)).toBe(true);

    expect(fs.readdirSync(dir.path)).toEqual(
      expect.arrayContaining(["file1.txt", "subdir"]),
    );

    expect(fs.readdirSync(path.join(dir.path, "subdir"))).toEqual(["file2.txt"]);

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("should create a test directory with with symlinks", () => {
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

    const dir = testdirSync(files);

    expect(fs.readdirSync(dir.path)).toEqual(
      expect.arrayContaining([
        "file1.txt",
        "file2.txt",
        "link4.txt",
        "link5.txt",
        "subdir",
      ]),
    );

    expect(fs.readdirSync(path.join(dir.path, "subdir"))).toEqual([
      "file3.txt",
      "file4.txt",
      "file5.txt",
    ]);
    expect(fs.readFileSync(path.join(dir.path, "file1.txt"), "utf8")).toBe("content1");
    expect(fs.readFileSync(path.join(dir.path, "file2.txt"), "utf8")).toBe("content2");
    expect(fs.readFileSync(path.join(dir.path, "link4.txt"), "utf8")).toBe("content1");
    expect(fs.statSync(path.join(dir.path, "link4.txt")).isFile()).toBe(true);

    expect(fs.readlinkSync(path.join(dir.path, "link5.txt"), "utf8")).toBeDefined();
    expect(fs.lstatSync(path.join(dir.path, "link5.txt")).isSymbolicLink()).toBe(true);

    expect(fs.readFileSync(path.join(dir.path, "subdir", "file3.txt"), "utf8")).toBe(
      "content3",
    );

    expect(fs.readFileSync(path.join(dir.path, "subdir", "file4.txt"), "utf8")).toBe(
      "content1",
    );
    expect(fs.statSync(path.join(dir.path, "subdir", "file4.txt")).isFile()).toBe(true);

    expect(
      fs.readlinkSync(path.join(dir.path, "subdir", "file5.txt"), "utf8"),
    ).toBeDefined();
    expect(
      fs.lstatSync(path.join(dir.path, "subdir", "file5.txt")).isSymbolicLink(),
    ).toBe(true);

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });

  it("use `from` to create a test directory from a file system path", () => {
    const dir = testdirSync.from("./test/fixtures/file-system/test-dir");

    expect(fs.existsSync(dir.path)).toBe(true);

    expect(fs.readdirSync(dir.path)).toEqual(
      expect.arrayContaining(["file.txt", "README.md", "nested"]),
    );

    expect(fs.readdirSync(path.join(dir.path, "nested"))).toEqual(expect.arrayContaining(["README.md", "image.txt"]));

    // removing directory
    dir.rm();
    expect(fs.existsSync(dir.path)).toBe(false);
  });
});

describe("create file trees", () => {
  it("should create a file tree at the specified path", () => {
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

    createFileTreeSync(dirPath, files);

    const file1Content = fs.readFileSync(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file2Content = fs.readFileSync(path.resolve(dirPath, "dir1/file2.txt"), "utf-8");
    expect(file2Content).toBe("This is file 2");

    const file3Content = fs.readFileSync(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    );
    expect(file3Content).toBe("This is file 3");

    const nestedFile = fs.readdirSync(path.resolve(dirPath, "this/is"));
    expect(nestedFile).toEqual(["nested.txt"]);

    const nestedFileContent = fs.readFileSync(
      path.resolve(dirPath, "this/is/nested.txt"),
      "utf-8",
    );
    expect(nestedFileContent).toBe("This is a file");
  });

  it("should create files using primitive types", () => {
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

    createFileTreeSync(dirPath, files);

    for (const [filename, content] of Object.entries(files)) {
      const fileContent = fs.readFileSync(path.resolve(dirPath, filename), "utf-8");
      if (content instanceof Uint8Array) {
        expect(fileContent).toBe("testdirs");
      } else {
        expect(fileContent).toBe(String(content));
      }
    }
  });

  it("should be able to create symlinks", () => {
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

    createFileTreeSync(dirPath, files);
    const file1Content = fs.readFileSync(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file2Content = fs.readFileSync(path.resolve(dirPath, "dir1/file2.txt"), "utf-8");

    expect(file2Content).toBe("This is file 2");

    const file3Content = fs.readFileSync(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    );

    expect(file3Content).toBe("This is file 3");

    const link2Content = fs.readFileSync(path.resolve(dirPath, "link2.txt"), "utf-8");

    expect(link2Content).toBe("This is file 2");
  });

  it.runIf(os.platform() !== "win32")("should be able to create files with different permissions", () => {
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

    expect(() => createFileTreeSync(dirPath, files)).toThrowError("EACCES: permission denied");

    const file1Content = fs.readFileSync(path.resolve(dirPath, "file1.txt"), "utf-8");
    expect(file1Content).toBe("Hello, world!");

    const file1Stats = fs.statSync(path.resolve(dirPath, "file1.txt"));
    expect((file1Stats.mode & 0o644).toString(8)).toBe("644");

    const file2Content = fs.readFileSync(
      path.resolve(dirPath, "dir1/file2.txt"),
      "utf-8",
    );
    expect(file2Content).toBe("This is file 2");

    const file2Stats = fs.statSync(path.resolve(dirPath, "dir1/file2.txt"));
    expect((file2Stats.mode & 0o444).toString(8)).toBe("444");

    const dir2Stats = fs.statSync(path.resolve(dirPath, "dir1/dir2"));
    expect((dir2Stats.mode & 0o555).toString(8)).toBe("555");

    // because the dir has a non writable permission, it should throw an error
    // because we can't create the file inside the dir
    expect(() => fs.readFileSync(
      path.resolve(dirPath, "dir1/dir2/file3.txt"),
      "utf-8",
    )).toThrowError("ENOENT: no such file or directory");

    expect(() => fs.writeFileSync(path.resolve(dirPath, "dir1/dir2/file3.txt"), "Hello, world!")).toThrowError("EACCES: permission denied");
  });
});

describe("map fs to objects", () => {
  describe("invalid paths or directories", () => {
    it("should return an empty object if the path does not exist", () => {
      const result = fromFileSystemSync("non-existent-path");

      expect(result).toEqual({});
    });

    it("should return an empty object if the path is not a directory", () => {
      const result = fromFileSystemSync("not-a-directory");

      expect(result).toEqual({});
    });
  });

  describe("handle symlinks", () => {
    it("should correctly handle symbolic links in the directory", () => {
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

      const result = fromFileSystemSync("./test/fixtures/symlinks");

      expect(result).toMatchObject(mockFiles);
    });

    it("should handle symbolic links using testdir", () => {
      const files = fromFileSystemSync("./test/fixtures/symlinks");

      const dir = testdirSync(files);

      const rootReadme = fs.readFileSync("./README.md", "utf8");
      const testdirReadme = fs.readFileSync(`${dir.path}/nested/double-nested/double-double-nested/README.md`, "utf8");

      expect(rootReadme).toStrictEqual(testdirReadme);

      // removing directory
      dir.rm();
      expect(fs.existsSync(dir.path)).toBe(false);
    });

    it("should handle symbolic links using testdir with custom path", () => {
      const files = fromFileSystemSync("./test/fixtures/symlinks");

      const dir = testdirSync(files, {
        dirname: "./three/levels/deep-sync",
      });

      const rootReadme = fs.readFileSync("./README.md", "utf8");
      const testdirReadme = fs.readFileSync(`${dir.path}/nested/double-nested/double-double-nested/README.md`, "utf8");

      expect(rootReadme).toStrictEqual(testdirReadme);

      // removing directory
      dir.rm();
      expect(fs.existsSync(dir.path)).toBe(false);
    });
  });

  describe("map file contents", () => {
    it("should return the directory structure with file contents", () => {
      const mockFiles = {
        "file.txt": "this is just a file!\n",
        "README.md": "# testdirs\n",
        "nested": {
          "README.md": "# Nested Fixture Folder\n",
          "image.txt": "Hello, World!\n",
        },
      };

      const result = fromFileSystemSync("./test/fixtures/file-system/test-dir");

      expect(result).toMatchObject(mockFiles);
    });

    it("should use different encodings when using `getEncodingForFile`", () => {
      const mockFiles = {
        "file.txt": "this is just a file!\n",
        "README.md": "# testdirs\n",
        "nested": {
          "README.md": "# Nested Fixture Folder\n",
          // eslint-disable-next-line node/prefer-global/buffer
          "image.txt": Buffer.from([72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10]),
        },
      };

      const result = fromFileSystemSync("./test/fixtures/file-system/test-dir", {
        getEncodingForFile: (path) => {
          return path.endsWith("image.txt") ? null : "utf8";
        },
      });

      expect(result).toMatchObject(mockFiles);
    });
  });
});
