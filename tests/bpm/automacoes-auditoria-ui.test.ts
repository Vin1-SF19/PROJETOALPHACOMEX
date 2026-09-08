import { stat, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AUTOMACOES_EXECUTAVEIS_AUDITADAS,
  CATALOGO_AUDITORIA_AUTOMACOES,
  INTEGRACOES_MANUAIS_AUDITADAS,
} from "@/lib/bpm/automacoes/catalogo-modulos";
import { TIPOS_ACAO_CENTRAL } from "@/lib/bpm/automacoes/central-schemas";

describe("auditoria visual das automações do Painel Alpha", () => {
  it("cobre exatamente todas as ações aceitas pelo Motor Central", () => {
    expect(AUTOMACOES_EXECUTAVEIS_AUDITADAS.map((item) => item.acaoTipo)).toEqual(TIPOS_ACAO_CENTRAL);
    expect(new Set(CATALOGO_AUDITORIA_AUTOMACOES.map((item) => item.id)).size).toBe(CATALOGO_AUDITORIA_AUTOMACOES.length);
    expect(AUTOMACOES_EXECUTAVEIS_AUDITADAS.every((item) => item.status === "EXECUTAVEL_MOTOR")).toBe(true);
  });

  it("exige evidência existente no repositório para cada item anunciado na UI", async () => {
    for (const item of CATALOGO_AUDITORIA_AUTOMACOES) {
      expect(item.evidencias.length, item.id).toBeGreaterThan(0);
      for (const caminho of item.evidencias) await expect(stat(caminho), `${item.id}: ${caminho}`).resolves.toBeTruthy();
    }
  });

  it("prova os executores das integrações prioritárias sem promover o Meet manual", async () => {
    const [executor, central, meet] = await Promise.all([
      readFile("src/lib/bpm/automacoes/executor.ts", "utf8"),
      readFile("src/lib/bpm/automacoes/central-runtime.ts", "utf8"),
      readFile("src/actions/bpm/GoogleMeet.ts", "utf8"),
    ]);
    expect(executor).toContain('params.acaoTipo === "GERAR_CONTRATO"');
    expect(executor).toContain('params.acaoTipo === "GERAR_FICHA"');
    expect(central).toContain('tipo === "SINCRONIZAR_TRANSCRICAO_REUNIAO"');
    expect(meet).toContain("export async function AgendarReuniaoGoogleMeetBpm");
    expect(TIPOS_ACAO_CENTRAL).not.toContain("AGENDAR_GOOGLE_MEET");
    expect(INTEGRACOES_MANUAIS_AUDITADAS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "AGENDAR_GOOGLE_MEET", status: "INTEGRACAO_MANUAL", acaoTipo: null }),
    ]));
  });

  it("exibe auditoria e mantém JSON somente no modo avançado do editor", async () => {
    const [workspace, auditoria, editor] = await Promise.all([
      readFile("src/components/bpm/automacoes/AutomacoesWorkspace.tsx", "utf8"),
      readFile("src/components/bpm/automacoes/AuditoriaAutomacoesCodigo.tsx", "utf8"),
      readFile("src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx", "utf8"),
    ]);
    expect(workspace).toContain("<AuditoriaAutomacoesCodigo");
    expect(auditoria).toContain("Auditoria das automações do código");
    expect(auditoria).toContain("Evidência no código");
    expect(editor).toContain("O que esta automação fará?");
    expect(editor).toContain("Modo avançado");
    expect(editor).toContain("Template do Gerador de Documentos");
  });
});
