import type { z } from "zod";
import type {
  DirectoryJSON,
  FactoryFn,
  TestdirFactoryOptions,
  TestdirFn,
  TestdirFromOptions,
  TestdirOptions,
  TestdirResult,
} from "./types";
import { fromFileSystem } from "./utils";

type InferOptions<S extends z.ZodTypeAny | undefined> = S extends z.ZodTypeAny
  ? z.output<S>
  : TestdirOptions;

export function createCustomTestdir<TOptionsSchema extends z.ZodTypeAny | undefined = undefined>(
  factoryFn: FactoryFn<InferOptions<TOptionsSchema>, TestdirResult>,
  opts: TestdirFactoryOptions<TOptionsSchema>,
): TestdirFn {
  const customTestdir: TestdirFn = async (
    files: DirectoryJSON,
    rawOptions?: TestdirOptions,
  ): Promise<TestdirResult> => {
    const parsedOptions = opts.optionsSchema
      ? (opts.optionsSchema.parse((rawOptions ?? {}) as unknown) as InferOptions<TOptionsSchema>)
      : (((rawOptions ?? {}) as unknown) as InferOptions<TOptionsSchema>);

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

  customTestdir.from = async (fsPath: string, options?: TestdirFromOptions) => {
    return customTestdir(await fromFileSystem(fsPath, options?.fromFS), { dirname: options?.dirname });
  };

  return customTestdir;
}
