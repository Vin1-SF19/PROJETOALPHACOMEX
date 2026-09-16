import { describe, expect, it } from "vitest";

import { readExplorerRuntimeFlags } from "@/lib/alpha-explorer/runtime";

describe("Alpha Explorer flags", () => {
  it("inicia fechado por padrão", () => {
    expect(readExplorerRuntimeFlags({})).toEqual({ enabled: false, writeEnabled: false, fallbackEnabled: false });
  });

  it("não interpreta valores ambíguos como habilitados", () => {
    expect(readExplorerRuntimeFlags({ ALPHA_EXPLORER_ENABLED: "1" }).enabled).toBe(false);
    expect(readExplorerRuntimeFlags({ ALPHA_EXPLORER_ENABLED: "true" }).enabled).toBe(true);
  });
});
