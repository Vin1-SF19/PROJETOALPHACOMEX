import "server-only";

import { z } from "zod";

const booleanFlag = z.preprocess(
  (value) => value === "true" ? "true" : "false",
  z.enum(["true", "false"]).transform((value) => value === "true"),
);

const explorerRuntimeSchema = z.object({
  enabled: booleanFlag,
  writeEnabled: booleanFlag,
  fallbackEnabled: booleanFlag,
}).strict();

export interface ExplorerRuntimeFlags {
  enabled: boolean;
  writeEnabled: boolean;
  fallbackEnabled: boolean;
}

export function readExplorerRuntimeFlags(env: Readonly<Record<string, string | undefined>> = process.env): ExplorerRuntimeFlags {
  return explorerRuntimeSchema.parse({
    enabled: env.ALPHA_EXPLORER_ENABLED,
    writeEnabled: env.ALPHA_EXPLORER_WRITE_ENABLED,
    fallbackEnabled: env.ALPHA_EXPLORER_FALLBACK_ENABLED,
  });
}
