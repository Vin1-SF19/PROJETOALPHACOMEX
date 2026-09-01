import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - tabs de serviço do card dinâmicas (RM-2026-29F59C)", () => {
  const layout = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
  const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");

  it("carrega os serviços do banco via getServicosComerciais, sem lista fixa", () => {
    expect(layout).toContain('import { getServicosComerciais } from "@/actions/ContratoComercial";');
    expect(layout).toContain('import { SERVICOS_COMERCIAIS_PADRAO } from "@/lib/comercial/servicos";');
    expect(layout).toContain("getServicosComerciais().then((res) => {");
    expect(layout).not.toContain("SERVICOS_FIXOS");
    expect(layout).not.toMatch(/\["Radar",\s*"TTD-409",\s*"Recupera/);
  });

  it("renderiza as tabs a partir do estado dinâmico `servicos`", () => {
    expect(layout).toContain("const [servicos, setServicos] = useState<string[]>([...SERVICOS_COMERCIAIS_PADRAO]);");
    expect(layout).toContain("{servicos.map((servico) => {");
    expect(layout).toContain("{servicos.map((servico) => (");
  });

  it("não mantém lista de serviços hardcoded morta no modal duplicado", () => {
    expect(modal).not.toContain("SERVICOS_FIXOS");
  });
});
