import type {
  DirectoryJSON,
  ExtendedTestdirFn,
  FactoryFn,
  TestdirFactoryOptions,
  TestdirFn,
  TestdirOptions,
} from "./types";
import { z } from "zod";

function parseOptions<TOptionsSchema extends z.ZodType>(
  rawOptions: TestdirOptions<TOptionsSchema> | undefined,
  optionsSchema: TOptionsSchema,
): TestdirOptions<TOptionsSchema> {
  try {
    const parsedOptions = optionsSchema.parse(rawOptions ?? {});

    if (typeof parsedOptions !== "object") {
      throw new TypeError("Custom options must be an object.");
    }

    return parsedOptions as TestdirOptions<TOptionsSchema>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(`Options validation failed: ${issues}`);
    }

    throw error;
  }
}

export function createCustomTestdir<
  TOptionsSchema extends z.ZodType,
  TResult = any,
  TExtensions extends Record<string, any> = Record<string, any>,
>(
  factoryFn: FactoryFn<TestdirOptions<TOptionsSchema>, TResult>,
  opts: TestdirFactoryOptions<TOptionsSchema, TResult, TExtensions>,
): ExtendedTestdirFn<TestdirOptions<TOptionsSchema>, TResult, TExtensions> {
  // check if the factory has dirname provided
  if (!("dirname" in opts)) {
    throw new Error("A dirname function must be provided in factory options.");
  }

  const customTestdir: TestdirFn<TestdirOptions<TOptionsSchema>, TResult> = async (
    files: DirectoryJSON,
    rawOptions?: TestdirOptions<TOptionsSchema>,
  ): Promise<TResult> => {
    const parsedOptions = parseOptions(rawOptions, opts.optionsSchema);

    const fixturePath = await opts.dirname(parsedOptions);

    if (opts.before) {
      await opts.before(parsedOptions);
    }

    let result: TResult;
    try {
      result = await factoryFn({
        options: parsedOptions,
        fixturePath,
        files,
      });
    } finally {
      if (opts.after) {
        await opts.after(parsedOptions);
      }
    }
    return result;
  };

  if (opts.extensions) {
    const extensions = opts.extensions(customTestdir);

    for (const [key, value] of Object.entries(extensions)) {
      (customTestdir as any)[key] = value;
    }
  }

  return customTestdir as ExtendedTestdirFn<TestdirOptions<TOptionsSchema>, TResult, TExtensions>;
}
