import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";
import { createCustomTestdir } from "../src/factory";

describe("createCustomTestdir", () => {
  it("should throw an error if dirname is not provided", async () => {
    expect(() => createCustomTestdir(async () => {
      return {};
    }, {} as any)).toThrow("A dirname function must be provided in factory options.");
  });

  it("should validate options with custom schema", async () => {
    const schema = z.object({
      timeout: z.number(),
      debug: z.boolean().optional(),
    });

    const testdir = createCustomTestdir(
      async ({ options }) => ({ options }),
      {
        optionsSchema: schema,
        dirname: () => path.join(tmpdir(), "test-schema"),
      },
    );

    const result = await testdir({}, { timeout: 5000, debug: true });
    expect(result.options.timeout).toBe(5000);
    expect(result.options.debug).toBe(true);
  });

  it("should throw validation error for invalid schema", async () => {
    const schema = z.object({
      timeout: z.number(),
      required: z.string(),
    });

    const testdir = createCustomTestdir(
      async ({ options }) => ({ options }),
      {
        optionsSchema: schema,
        dirname: () => path.join(tmpdir(), "test-invalid"),
      },
    );

    const tdPromise = testdir({}, {
      timeout: "invalid",
    } as any);

    await expect(tdPromise)
      .rejects.toThrow("Options validation failed");
  });

  describe("hook execution order", () => {
    it("should call hooks in the correct sequence: before → factory → after", async () => {
      const callOrder = vi.fn();
      const beforeHook = vi.fn(() => callOrder("before"));
      const afterHook = vi.fn(() => callOrder("after"));
      const factoryFn = vi.fn(async () => {
        callOrder("factory");
        return { result: "success" };
      });

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({}),
        before: beforeHook,
        after: afterHook,
        dirname: () => path.join(tmpdir(), "test-order"),
      });

      const result = await testdir({});

      expect(result.result).toBe("success");
      expect(callOrder).toHaveBeenNthCalledWith(1, "before");
      expect(callOrder).toHaveBeenNthCalledWith(2, "factory");
      expect(callOrder).toHaveBeenNthCalledWith(3, "after");
      expect(beforeHook).toHaveBeenCalledBefore(factoryFn);
      expect(factoryFn).toHaveBeenCalledBefore(afterHook);
    });

    it("should call hooks with the same parsed options", async () => {
      const beforeHook = vi.fn();
      const afterHook = vi.fn();
      const factoryFn = vi.fn(async ({ options }) => ({ receivedOptions: options }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({ testValue: z.string().optional() }),
        before: beforeHook,
        after: afterHook,
        dirname: () => path.join(tmpdir(), "test-options"),
      });

      const inputOptions = { testValue: "test123" };
      await testdir({}, inputOptions);

      expect(beforeHook).toHaveBeenCalledWith(inputOptions);
      expect(afterHook).toHaveBeenCalledWith(inputOptions);
      expect(factoryFn).toHaveBeenCalledWith({
        options: inputOptions,
        fixturePath: expect.any(String),
        files: {},
      });
    });

    it("should handle async hooks properly", async () => {
      const executionOrder: string[] = [];

      const beforeHook = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push("before-completed");
      });

      const afterHook = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        executionOrder.push("after-completed");
      });

      const factoryFn = vi.fn(async () => {
        executionOrder.push("factory-executed");
        return { success: true };
      });

      const testdir = createCustomTestdir(
        factoryFn,
        {
          optionsSchema: z.object({}),
          before: beforeHook,
          after: afterHook,
          dirname: () => path.join(tmpdir(), "test-async"),
        },
      );

      await testdir({});

      expect(beforeHook).toHaveBeenCalledOnce();
      expect(afterHook).toHaveBeenCalledOnce();
      expect(factoryFn).toHaveBeenCalledOnce();
      expect(executionOrder).toEqual([
        "before-completed",
        "factory-executed",
        "after-completed",
      ]);
    });

    it("should work without hooks", async () => {
      const factoryFn = vi.fn(async () => ({ noHooks: true }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({}),
        dirname: () => path.join(tmpdir(), "test-no-hooks"),
      });

      const result = await testdir({});

      expect(result.noHooks).toBe(true);
      expect(factoryFn).toHaveBeenCalledOnce();
    });
  });

  it("should pass files to factory function", async () => {
    const factoryFn = vi.fn(async ({ files }) => ({ receivedFiles: files }));
    const testFiles = {
      "test.txt": "hello world",
      "nested/file.js": "console.log('test');",
      "data.json": "{\"key\": \"value\"}",
    };

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({}),
      dirname: () => path.join(tmpdir(), "test-files"),
    });

    const result = await testdir(testFiles);

    expect(result.receivedFiles).toEqual(testFiles);
    expect(factoryFn).toHaveBeenCalledWith({
      files: testFiles,
      options: {},
      fixturePath: expect.any(String),
    });
  });

  it("should provide correct fixture path to factory", async () => {
    const expectedPath = path.join(tmpdir(), "custom-fixture-path");
    const factoryFn = vi.fn(async ({ fixturePath }) => ({ path: fixturePath }));

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({}),
      dirname: () => expectedPath,
    });

    const result = await testdir({});

    expect(result.path).toBe(expectedPath);
    expect(factoryFn).toHaveBeenCalledWith({
      files: {},
      options: {},
      fixturePath: expectedPath,
    });
  });

  it("should provide complete context object to factory", async () => {
    const factoryFn = vi.fn(async (context) => ({ context }));
    const testFiles = { "app.js": "console.log('app');" };
    const testOptions = { debug: true, timeout: 3000 };
    const expectedPath = path.join(tmpdir(), "context-test");

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({
        debug: z.boolean().optional(),
        timeout: z.number().optional(),
      }),
      dirname: () => expectedPath,
    });

    const result = await testdir(testFiles, testOptions);

    expect(result.context).toEqual({
      files: testFiles,
      options: testOptions,
      fixturePath: expectedPath,
    });
    expect(factoryFn).toHaveBeenCalledWith({
      files: testFiles,
      options: testOptions,
      fixturePath: expectedPath,
    });
  });

  it("should handle empty files object", async () => {
    const factoryFn = vi.fn(async ({ files }) => ({
      isEmpty: Object.keys(files).length === 0,
      files,
    }));

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({}),
      dirname: () => path.join(tmpdir(), "empty-files"),
    });

    const result = await testdir({});

    expect(result.isEmpty).toBe(true);
    expect(result.files).toEqual({});
  });

  it("should handle nested file structures", async () => {
    const factoryFn = vi.fn(async ({ files }) => ({ files }));
    const nestedFiles = {
      "src/index.js": "export default 'main';",
      "src/utils/helper.js": "export const help = () => {};",
      "tests/unit/app.test.js": "test('app', () => {});",
      "package.json": "{\"name\": \"test-app\"}",
      "README.md": "# Test App",
    };

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({}),
      dirname: () => path.join(tmpdir(), "nested-structure"),
    });

    const result = await testdir(nestedFiles);

    expect(result.files).toEqual(nestedFiles);
    expect(Object.keys(result.files)).toHaveLength(5);
  });

  it("should work with async dirname function", async () => {
    const factoryFn = vi.fn(async ({ fixturePath }) => ({ path: fixturePath }));
    const asyncDirname = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return path.join(tmpdir(), "async-dirname");
    });

    const testdir = createCustomTestdir(factoryFn, {
      optionsSchema: z.object({}),
      dirname: asyncDirname,
    });

    const result = await testdir({});

    expect(asyncDirname).toHaveBeenCalledOnce();
    expect(result.path).toBe(path.join(tmpdir(), "async-dirname"));
  });

  describe("extension system", () => {
    it("should create extensions and make them available on testdir", async () => {
      const factoryFn = vi.fn(async ({ options }) => ({ result: options }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({ debug: z.boolean().optional() }),
        dirname: () => path.join(tmpdir(), "extension-test"),
        extensions: {
          hello: (name: string) => `Hello, ${name}!`,
          withDebug: (files: any) => testdir(files, { debug: true }),
          quick: () => testdir({}),
        },
      });

      expect(typeof testdir.hello).toBe("function");
      expect(typeof testdir.withDebug).toBe("function");
      expect(typeof testdir.quick).toBe("function");

      expectTypeOf(testdir.hello).toEqualTypeOf<(name: string) => string>();
      expectTypeOf(testdir.withDebug).toEqualTypeOf<(files: any) => Promise<{
        result: any;
      }>>();
      expectTypeOf(testdir.quick).toEqualTypeOf<() => Promise<{
        result: any;
      }>>();

      expect(testdir.hello("World")).toBe("Hello, World!");

      const quickResult = await testdir.quick();
      expect(quickResult.result).toEqual({});

      const debugResult = await testdir.withDebug({});
      expect(debugResult.result).toEqual({ debug: true });
    });

    it("should work without extensions", async () => {
      const factoryFn = vi.fn(async () => ({ success: true }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({}),
        dirname: () => path.join(tmpdir(), "no-extensions"),
      });

      const result = await testdir({});
      expect(result.success).toBe(true);

      expect(testdir).not.toHaveProperty("hello");
      expect(testdir).not.toHaveProperty("withDebug");
      expect(testdir).not.toHaveProperty("quick");
    });

    it("should handle complex extensions with multiple parameters", async () => {
      const factoryFn = vi.fn(async ({ options, files }) => ({ options, files }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({
          env: z.string().optional(),
          port: z.number().optional(),
        }),
        dirname: () => path.join(tmpdir(), "complex-extensions"),
        extensions: {
          withEnv: (env: string, files: any = {}) => testdir(files, { env }),
          withPort: (port: number) => testdir({}, { port }),
          withBoth: (env: string, port: number, files: any = {}) =>
            testdir(files, { env, port }),
        },
      });

      const envResult = await testdir.withEnv("production", { "app.js": "console.log('prod');" });
      expect(envResult.options.env).toBe("production");
      expect(envResult.files).toEqual({ "app.js": "console.log('prod');" });

      const portResult = await testdir.withPort(3000);
      expect(portResult.options.port).toBe(3000);

      const bothResult = await testdir.withBoth("staging", 8080, { "config.json": "{}" });
      expect(bothResult.options).toEqual({ env: "staging", port: 8080 });
      expect(bothResult.files).toEqual({ "config.json": "{}" });
    });

    it("should allow extensions to access parsed options from factory", async () => {
      const factoryFn = vi.fn(async ({ options }) => ({ receivedOptions: options }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({ baseUrl: z.string().default("http://localhost") }),
        dirname: () => path.join(tmpdir(), "options-access"),
        extensions: {
          apiCall: (_endpoint: string) => testdir({}, { baseUrl: "https://api.example.com" }),
          localCall: (_endpoint: string) => testdir({}), // Uses default baseUrl
        },
      });

      const apiResult = await testdir.apiCall("/users");
      expect(apiResult.receivedOptions.baseUrl).toBe("https://api.example.com");

      const localResult = await testdir.localCall("/health");
      expect(localResult.receivedOptions.baseUrl).toBe("http://localhost");
    });

    it("should handle errors thrown by extension methods", async () => {
      const factoryFn = vi.fn(async () => ({ success: true }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({}),
        dirname: () => path.join(tmpdir(), "error-test"),
        extensions: {
          failing: () => {
            throw new Error("Extension error");
          },
          asyncFailing: async () => {
            throw new Error("Async extension error");
          },
        },
      });

      expect(() => testdir.failing()).toThrow("Extension error");
      await expect(testdir.asyncFailing()).rejects.toThrow("Async extension error");
    });

    it("should handle errors in factory function while using extensions", async () => {
      const factoryFn = vi.fn(async () => {
        throw new Error("Factory error");
      });

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({}),
        dirname: () => path.join(tmpdir(), "factory-error-test"),
        extensions: {
          callFactory: () => testdir({}),
        },
      });

      await expect(testdir.callFactory()).rejects.toThrow("Factory error");
    });

    it("should handle validation errors in extensions", async () => {
      const factoryFn = vi.fn(async ({ options }) => ({ options }));

      const testdir = createCustomTestdir(factoryFn, {
        optionsSchema: z.object({
          required: z.string(),
          port: z.number(),
        }),
        dirname: () => path.join(tmpdir(), "validation-error-test"),
        extensions: {
          withInvalidOptions: () => testdir({}, { port: "not-a-number" } as any),
          withMissingRequired: () => testdir({}, {
            port: 3000,
          } as any),
        },
      });

      await expect(testdir.withInvalidOptions()).rejects.toThrow("Options validation failed");
      await expect(testdir.withMissingRequired()).rejects.toThrow("Options validation failed");
    });
  });
});
