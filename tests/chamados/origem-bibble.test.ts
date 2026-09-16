import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE,
  marcarDescricaoComoAbertaViaBibble,
  separarOrigemBibbleDaDescricao,
} from "@/lib/chamados/origem-bibble";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("origem dos chamados abertos via Bibble", () => {
  it("adiciona exatamente um marcador no topo de forma idempotente", () => {
    const descricao = "Falha ao acessar o sistema";
    const marcada = marcarDescricaoComoAbertaViaBibble(descricao);

    expect(marcada).toBe(`${MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE}\n\n${descricao}`);
    expect(marcarDescricaoComoAbertaViaBibble(marcada)).toBe(marcada);
    const normalizada = marcarDescricaoComoAbertaViaBibble(
      `${MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE}\n${marcada}`,
    );
    expect(normalizada.split(MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE)).toHaveLength(2);
  });

  it("detecta o marcador com whitespace inicial e separa a ocorrência limpa", () => {
    expect(separarOrigemBibbleDaDescricao(
      ` \n\t${MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE}\n\n  Computador sem rede  `,
    )).toEqual({
      abertoViaBibble: true,
      descricaoLimpa: "Computador sem rede",
    });
  });

  it("não classifica como origem Bibble quando o marcador aparece apenas no corpo", () => {
    const descricao = `Texto citado ${MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE}`;

    expect(separarOrigemBibbleDaDescricao(descricao)).toEqual({
      abertoViaBibble: false,
      descricaoLimpa: descricao,
    });
  });

  it("liga os dois caminhos de criação ao helper compartilhado", () => {
    const executor = ler("src/lib/bibble/tool-executor.ts");
    const rota = ler("src/app/api/ChatBot/AbrirChamado/route.ts");

    expect(executor).toContain("descricao: marcarDescricaoComoAbertaViaBibble(descricao)");
    expect(rota).toContain("descricao: marcarDescricaoComoAbertaViaBibble(String(descricao ?? \"\"))");
  });

  it("exibe badge e ocorrência limpa nas duas interfaces de atendimento", () => {
    const detalhes = ler("src/components/DetalhesChamado.tsx");
    const painel = ler("src/components/chamados/ChamadosOperacionaisPainel.tsx");

    for (const interfaceChamado of [detalhes, painel]) {
      expect(interfaceChamado).toContain("separarOrigemBibbleDaDescricao(chamado.descricao)");
      expect(interfaceChamado).toContain("data-origem-bibble");
      expect(interfaceChamado).toContain("origemBibble.descricaoLimpa");
    }
  });
});
