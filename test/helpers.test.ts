import { basename, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_METADATA_SYMBOL, FIXTURE_TYPE_LINK_SYMBOL, FIXTURE_TYPE_SYMLINK_SYMBOL } from "../src/constants";
import { captureSnapshot, hasMetadata, isLink, isPrimitive, isSymlink, link, metadata, symlink } from "../src/helpers";
import { testdir } from "../src/index";

describe("symlinks", () => {
  it("should create symlinks", () => {
    const path = "/test/path";
    const result = symlink(path);
    expect(result).toEqual({
      [FIXTURE_TYPE_SYMLINK_SYMBOL]: FIXTURE_TYPE_SYMLINK_SYMBOL,
      path: normalize(path),
    });
  });

  it("should create symlinks with relative paths", () => {
    const path = "../test/path";
    const result = symlink(path);
    expect(result).toEqual({
      [FIXTURE_TYPE_SYMLINK_SYMBOL]: FIXTURE_TYPE_SYMLINK_SYMBOL,
      path: normalize(path),
    });
  });

  it("should create symlinks with empty paths", () => {
    const path = "";
    const result = symlink(path);

    expect(result).toEqual({
      [FIXTURE_TYPE_SYMLINK_SYMBOL]: FIXTURE_TYPE_SYMLINK_SYMBOL,
      path: normalize(path),
    });
  });

  describe("detect symlinks", () => {
    it("should detect symlinks", () => {
      const symlinkFixture = symlink("/test/path");
      expect(isSymlink(symlinkFixture)).toBe(true);
    });

    it("should detect links", () => {
      const linkFixture = link("/test/path");
      expect(isSymlink(linkFixture)).toBe(false);
    });

    it("should not detect other objects", () => {
      expect(isSymlink({})).toBe(false);
      expect(isSymlink(null)).toBe(false);
      expect(isSymlink(undefined)).toBe(false);
      expect(isSymlink("")).toBe(false);
      expect(isSymlink(123)).toBe(false);
      expect(isSymlink([])).toBe(false);
    });
  });
});

describe("links", () => {
  it("should create links", () => {
    const path = "/test/path";
    const result = link(path);
    expect(result).toEqual({
      [FIXTURE_TYPE_LINK_SYMBOL]: FIXTURE_TYPE_LINK_SYMBOL,
      path: normalize(path),
    });
  });

  it("should create links with relative paths", () => {
    const path = "../test/path";
    const result = link(path);
    expect(result).toEqual({
      [FIXTURE_TYPE_LINK_SYMBOL]: FIXTURE_TYPE_LINK_SYMBOL,
      path: normalize(path),
    });
  });

  it("should create links with empty paths", () => {
    const path = "";
    const result = link(path);

    expect(result).toEqual({
      [FIXTURE_TYPE_LINK_SYMBOL]: FIXTURE_TYPE_LINK_SYMBOL,
      path: normalize(path),
    });
  });

  describe("detect links", () => {
    it("should detect links", () => {
      const linkFixture = link("/test/path");
      expect(isLink(linkFixture)).toBe(true);
    });

    it("should detect symlinks", () => {
      const symlinkFixture = symlink("/test/path");
      expect(isLink(symlinkFixture)).toBe(false);
    });

    it("should not detect other objects", () => {
      expect(isLink({})).toBe(false);
      expect(isLink(null)).toBe(false);
      expect(isLink(undefined)).toBe(false);
      expect(isLink("")).toBe(false);
      expect(isLink(123)).toBe(false);
      expect(isLink([])).toBe(false);
    });
  });
});

describe("metadata", () => {
  it("should combine content with metadata", () => {
    const content = "some content";
    const fsMetadata = { mode: 0o777 };
    const result = metadata(content, fsMetadata);
    expect(result).toEqual({
      [FIXTURE_METADATA_SYMBOL]: fsMetadata,
      content,
    });
  });

  it("should work with directory JSON content", () => {
    const content = { "file.txt": "content" };
    const fsMetadata = { mode: 0o444 };
    const result = metadata(content, fsMetadata);
    expect(result).toEqual({
      [FIXTURE_METADATA_SYMBOL]: fsMetadata,
      content,
    });
  });

  it("should preserve metadata object properties", () => {
    const content = "test";
    const fsMetadata = {
      mode: 0o755,
    };

    const result = metadata(content, fsMetadata);
    expect(result).toEqual({
      [FIXTURE_METADATA_SYMBOL]: fsMetadata,
      content,
    });
  });

  it("should work with empty content", () => {
    const content = {};
    const fsMetadata = { mode: 0o777 };
    const result = metadata(content, fsMetadata);
    expect(result).toEqual({
      [FIXTURE_METADATA_SYMBOL]: fsMetadata,
      content,
    });
  });

  it("should work with empty metadata", () => {
    const content = "some content";
    const fsMetadata = {};
    const result = metadata(content, fsMetadata);
    expect(result).toEqual({
      [FIXTURE_METADATA_SYMBOL]: fsMetadata,
      content,
    });
  });

  describe("detect metadata", () => {
    it("should detect metadata", () => {
      const metadataFixture = metadata("content", { mode: 0o777 });
      expect(hasMetadata(metadataFixture)).toBe(true);
    });

    it("should not detect other objects", () => {
      expect(hasMetadata({})).toBe(false);
      expect(hasMetadata(null)).toBe(false);
      expect(hasMetadata(undefined)).toBe(false);
      expect(hasMetadata("")).toBe(false);
      expect(hasMetadata(123)).toBe(false);
      expect(hasMetadata([])).toBe(false);
    });
  });
});

describe("isPrimitive", () => {
  it("should detect primitive strings", () => {
    expect(isPrimitive("test")).toBe(true);
    expect(isPrimitive("")).toBe(true);
  });

  it("should detect primitive numbers", () => {
    expect(isPrimitive(123)).toBe(true);
    expect(isPrimitive(0)).toBe(true);
    expect(isPrimitive(Number.NaN)).toBe(true);
  });

  it("should detect primitive booleans", () => {
    expect(isPrimitive(true)).toBe(true);
    expect(isPrimitive(false)).toBe(true);
  });

  it("should detect null and undefined", () => {
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(undefined)).toBe(true);
  });

  it("should detect bigint", () => {
    expect(isPrimitive(BigInt(123))).toBe(true);
  });

  it("should detect symbol", () => {
    expect(isPrimitive(Symbol("test"))).toBe(true);
  });

  it("should detect Uint8Array", () => {
    expect(isPrimitive(new Uint8Array())).toBe(true);
  });

  it("should not detect objects", () => {
    expect(isPrimitive({})).toBe(false);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive(new Date())).toBe(false);
  });

  it("should not detect functions", () => {
    expect(isPrimitive(() => {})).toBe(false);
    expect(isPrimitive(() => {})).toBe(false);
  });
});

describe("captureSnapshot", () => {
  it("should capture empty directory", async () => {
    await using dir = await testdir({});

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);
    expect(result).toBe(`${dirName}/`);
  });

  it("should capture directory with single file", async () => {
    await using dir = await testdir({
      "test.txt": "content",
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "└── test.txt",
    ].join("\n"));
  });

  it("should capture directory with multiple files", async () => {
    await using dir = await testdir({
      "a.txt": "content",
      "b.txt": "content",
      "c.txt": "content",
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "├── a.txt",
      "├── b.txt",
      "└── c.txt",
    ].join("\n"));
  });

  it("should capture nested directory structure", async () => {
    await using dir = await testdir({
      "file.txt": "content",
      "subdir": {
        "nested.txt": "content",
      },
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "├── subdir/",
      "│   └── nested.txt",
      "└── file.txt",
    ].join("\n"));
  });

  it("should capture complex directory tree", async () => {
    await using dir = await testdir({
      "README.md": "content",
      "cat": {
        "cat.html": "content",
        "cat.md": "content",
        "cat.txt": "content",
      },
      "dog": {
        "dog.html": "content",
        "dog.md": "content",
        "dog.txt": "content",
        "elf": {
          "elf.html": "content",
          "elf.md": "content",
          "elf.txt": "content",
        },
      },
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "├── cat/",
      "│   ├── cat.html",
      "│   ├── cat.md",
      "│   └── cat.txt",
      "├── dog/",
      "│   ├── elf/",
      "│   │   ├── elf.html",
      "│   │   ├── elf.md",
      "│   │   └── elf.txt",
      "│   ├── dog.html",
      "│   ├── dog.md",
      "│   └── dog.txt",
      "└── README.md",
    ].join("\n"));
  });

  it("should handle directories with mixed content", async () => {
    await using dir = await testdir({
      "empty-dir": {},
      "file1.txt": "content",
      "non-empty": {
        "file2.txt": "content",
      },
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "├── empty-dir/",
      "├── non-empty/",
      "│   └── file2.txt",
      "└── file1.txt",
    ].join("\n"));
  });

  it("should sort files and directories alphabetically", async () => {
    await using dir = await testdir({
      "z-dir": {},
      "a-dir": {},
      "z-file.txt": "content",
      "a-file.txt": "content",
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "├── a-dir/",
      "├── z-dir/",
      "├── a-file.txt",
      "└── z-file.txt",
    ].join("\n"));
  });

  it("should handle deeply nested structures", async () => {
    await using dir = await testdir({
      level1: {
        level2: {
          level3: {
            "deep.txt": "content",
          },
        },
      },
    });

    const result = await captureSnapshot(dir.path);
    const dirName = basename(dir.path);

    expect(result).toBe([
      `${dirName}/`,
      "└── level1/",
      "    └── level2/",
      "        └── level3/",
      "            └── deep.txt",
    ].join("\n"));
  });

  it("should throw error for non-existent directory", async () => {
    await expect(captureSnapshot("/non/existent/path")).rejects.toThrow();
  });
});
