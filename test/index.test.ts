import fsAsync from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { testdir } from "../src";
import { link, symlink } from "../src/helpers";

const OS_TMP_DIR = os.tmpdir();

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
    await dir.remove();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("should use random directory name if dirname is not provided", async () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = await testdir(files);
    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(["file1.txt"]);
    expect(dir.path).toContain(path.normalize(`${await fsAsync.realpath(OS_TMP_DIR)}/testdirs-`));

    // removing directory
    await dir.remove();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("use the provided dirname", async () => {
    const files = {
      "file1.txt": "content1",
    };

    const dir = await testdir(files, { dirname: "custom-dirname" });
    expect(await existsAsync(dir.path)).toBe(true);

    expect(dir.path).toContain(path.normalize(`${process.cwd()}/custom-dirname`));

    // removing directory
    await dir.remove();
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
    await dir.remove();
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
    await dir.remove();
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
    await dir.remove();
    expect(await existsAsync(dir.path)).toBe(false);
  });

  it("use `from` to create a test directory from a file system path", async () => {
    const dir = await testdir.from("./test/fixtures/file-system/test-dir");
    expect(await existsAsync(dir.path)).toBe(true);

    expect(await fsAsync.readdir(dir.path)).toEqual(
      expect.arrayContaining(["file.txt", "README.md", "nested"]),
    );

    expect(await fsAsync.readdir(path.join(dir.path, "nested"))).toEqual(expect.arrayContaining(["README.md", "image.txt"]));

    // removing directory
    await dir.remove();
    expect(await existsAsync(dir.path)).toBe(false);
  });
});
