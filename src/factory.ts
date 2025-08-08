import type {
  DirectoryJSON,
  ExtendedTestdirFn,
  FactoryFn,
  TestdirFactoryOptions,
  TestdirFn,
  TestdirInputOptions,
} from "./types";
import { z } from "zod";

function parseOptions<TOptionsSchema extends z.ZodType>(
  rawOptions: TestdirInputOptions<TOptionsSchema> | undefined,
  optionsSchema: TOptionsSchema,
): TestdirInputOptions<TOptionsSchema> {
  try {
    const parsedOptions = optionsSchema.parse(rawOptions ?? {});

    if (typeof parsedOptions !== "object") {
      throw new TypeError("Custom options must be an object.");
    }

    return parsedOptions as TestdirInputOptions<TOptionsSchema>;
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
  TResult,
  // eslint-disable-next-line ts/no-empty-object-type
  TExtensions extends Record<string, any> = {},
>(
  factoryFn: FactoryFn<TestdirInputOptions<TOptionsSchema>, TResult>,
  opts: TestdirFactoryOptions<TOptionsSchema, TExtensions>,
): ExtendedTestdirFn<TestdirInputOptions<TOptionsSchema>, TResult, TExtensions> {
  // check if the factory has dirname provided
  if (!("dirname" in opts)) {
    throw new Error("A dirname function must be provided in factory options.");
  }

  const customTestdir: TestdirFn<TestdirInputOptions<TOptionsSchema>, TResult> = async (
    files: DirectoryJSON,
    rawOptions?: TestdirInputOptions<TOptionsSchema>,
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
    const extensions = opts.extensions;

    for (const [key, value] of Object.entries(extensions)) {
      (customTestdir as any)[key] = value;
    }
  }

  return customTestdir as ExtendedTestdirFn<TestdirInputOptions<TOptionsSchema>, TResult, TExtensions>;
}
