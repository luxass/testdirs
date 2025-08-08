import type {
  DefaultTestdirOptions,
  DirectoryJSON,
  FactoryFn,
  TestdirFactoryOptions,
  TestdirFn,
  TestdirOptions,
} from "./types";
import { z } from "zod";

function parseOptions<TOptionsSchema extends z.ZodType = z.ZodNever>(
  rawOptions: DefaultTestdirOptions | undefined,
  optionsSchema: TOptionsSchema,
): TestdirOptions<TOptionsSchema> {
  const baseOptions = rawOptions ?? {};

  try {
    // extract dirname before validation since it's always allowed
    const { dirname, ...customOptionsInput } = baseOptions;

    // parse only the custom options
    const customOptions = optionsSchema.parse(customOptionsInput);

    if (typeof customOptions !== "object") {
      throw new TypeError("Custom options must be an object.");
    }

    return {
      ...customOptions,
      dirname,
    } as TestdirOptions<TOptionsSchema>;
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
  const customTestdir: TestdirFn<TResult, TestdirOptions<TOptionsSchema>> = async (
    files: DirectoryJSON,
    rawOptions?: DefaultTestdirOptions,
  ): Promise<TResult> => {
    const parsedOptions = parseOptions(rawOptions, opts.optionsSchema ?? z.never().optional());

    if (!("dirname" in opts)) {
      throw new Error("A dirname function must be provided in factory options.");
    }

    const fixturePath = opts.dirname(parsedOptions);

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
