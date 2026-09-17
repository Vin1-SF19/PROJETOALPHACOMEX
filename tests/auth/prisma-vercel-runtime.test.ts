import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

const PRISMA_QUERY_COMPILER =
  "./node_modules/.prisma/client/query_compiler_bg.wasm";

describe("Prisma no runtime serverless da Vercel", () => {
  it("inclui o compilador WASM no output file tracing do Next", () => {
    const includes = nextConfig.outputFileTracingIncludes?.["/**"] ?? [];

    expect(includes).toContain(PRISMA_QUERY_COMPILER);
    expect(existsSync(resolve(process.cwd(), PRISMA_QUERY_COMPILER))).toBe(true);
  });
});
