import type {
  DirectoryJSON,
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
>(
  factoryFn: FactoryFn<TestdirOptions<TOptionsSchema>, TResult>,
  opts: TestdirFactoryOptions<TOptionsSchema>,
): TestdirFn<TResult, TestdirOptions<TOptionsSchema>> {
  // check if the factory has dirname provided
  if (!("dirname" in opts)) {
    throw new Error("A dirname function must be provided in factory options.");
  }

  const customTestdir: TestdirFn<TResult, TestdirOptions<TOptionsSchema>> = async (
    files: DirectoryJSON,
    rawOptions?: TestdirOptions<TOptionsSchema>,
  ): Promise<TResult> => {
    const parsedOptions = parseOptions(rawOptions, opts.optionsSchema);

    const fixturePath = await opts.dirname(parsedOptions);

    if (opts.before) {
      await opts.before(parsedOptions);
    }

    const result = await factoryFn({
      options: parsedOptions,
      fixturePath,
      files,
    });

    if (opts.after) {
      await opts.after(parsedOptions);
    }

    return result;
  };

  return customTestdir;
}
