import type { z } from "zod";
import type {
  DefaultTestdirOptions,
  DirectoryJSON,
  FactoryFn,
  MergeOptionsWithSchema,
  TestdirFactoryOptions,
  TestdirFn,
} from "./types";

export function createCustomTestdir<
  TOptionsSchema extends z.ZodTypeAny | undefined = undefined,
  TResult = any,
>(
  factoryFn: FactoryFn<MergeOptionsWithSchema<TOptionsSchema>, TResult>,
  opts: TestdirFactoryOptions<TOptionsSchema>,
): TestdirFn<TResult> {
  const customTestdir: TestdirFn<TResult> = async (
    files: DirectoryJSON,
    rawOptions?: DefaultTestdirOptions,
  ): Promise<TResult> => {
    const parsedOptions = opts.optionsSchema
      ? (opts.optionsSchema.parse((rawOptions ?? {}) as unknown) as MergeOptionsWithSchema<TOptionsSchema>)
      : (((rawOptions ?? {}) as unknown) as MergeOptionsWithSchema<TOptionsSchema>);

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
