import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  configuracaoEntradaFechadoEhValida,
  STATUS_POS_FECHAMENTO_INICIAL,
} from "@/lib/bpm/status-pos-fechamento";

const root = process.cwd();
const ler = (arquivo: string) => readFileSync(path.join(root, arquivo), "utf8");

describe("Fechado — contrato canônico", () => {
  it("mantém o status inicial do domínio", () => {
    expect(STATUS_POS_FECHAMENTO_INICIAL).toBe("AGUARDANDO_CONTRATO");
  });

  it("aceita configuração inequívoca dos campos de entrada", () => {
    expect(configuracaoEntradaFechadoEhValida([
      { nome: "Valor acordado no contrato", tipo: "numero", opcoesJson: null, obrigatorio: true, contexto: "DESTINO" },
      { nome: "Forma de pagamento", tipo: "selecao", opcoesJson: JSON.stringify(["Pix"]), obrigatorio: true, contexto: "DESTINO" },
    ])).toBe(true);
  });

  it("rejeita configuração duplicada ou incompleta", () => {
    expect(configuracaoEntradaFechadoEhValida([
      { nome: "Valor acordado no contrato", tipo: "numero", opcoesJson: null, obrigatorio: true },
      { nome: "Valor acordado no contrato", tipo: "numero", opcoesJson: null, obrigatorio: true },
    ])).toBe(false);
  });

  it("movimento usa o comando canônico e não consulta relação campo-etapa legada", () => {
    const cards = ler("src/actions/bpm/Cards.ts");
    expect(cards).toContain("executarTransicaoBpm");
    expect(cards).not.toContain("bpmCampoObrigatorioEtapa");
    expect(cards).not.toContain("bpmCampoOcultoEtapa");
  });
});
