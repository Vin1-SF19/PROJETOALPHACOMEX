import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const componente = readFileSync(
  join(process.cwd(), "src/components/ComponentesRadar/HabilitacaoRadarClient.tsx"),
  "utf8",
);

describe("atalho externo da Consulta Radar", () => {
  it("abre o Portal Siscomex público e não mantém o endereço legado", () => {
    expect(componente).toContain(
      'href="https://portalunico.siscomex.gov.br/cint/#/habilitacao-situacao?perfil=publico"',
    );
    expect(componente).toContain("🌐 Portal Siscomex");
    expect(componente).not.toContain(
      "servicos.receita.fazenda.gov.br/servicos/radar/consultaSituacaoCpfCnpj.asp",
    );
  });
});
