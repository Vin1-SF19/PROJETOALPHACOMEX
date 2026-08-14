import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { criarTarefaPresetSchema, criarTarefaSchema } from "@/lib/validations/bpm";
import { BPM_TAREFA_TIPOS, obterConfigTipoTarefa } from "@/lib/bpm/tarefas-tipo";

const cardId = "ckx1234567890123456789012";
const prazo = "2026-08-20T15:00:00.000Z";
const alerta = "2026-08-20T14:00:00.000Z";
const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - tarefas por tipo", () => {
  it("mantém o catálogo completo de tipos com labels", () => {
    expect(BPM_TAREFA_TIPOS).toEqual(["CHECKLIST", "LIGACAO", "WHATSAPP", "EMAIL", "TAREFA", "LEMBRETE_RAPIDO"]);
    expect(obterConfigTipoTarefa("WHATSAPP").label).toBe("WhatsApp");
    expect(obterConfigTipoTarefa("desconhecido").label).toBe("Tarefa");
  });

  it("exige prazo e alerta anterior ao prazo", () => {
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "TAREFA", titulo: "Retornar", prazo }).success).toBe(false);
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "TAREFA", titulo: "Retornar", prazo, alertaEm: "2026-08-21T14:00:00.000Z" }).success).toBe(false);
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "TAREFA", titulo: "Retornar", prazo, alertaEm: alerta }).success).toBe(true);
  });

  it("valida os campos particulares de checklist, ligação, WhatsApp e e-mail", () => {
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "CHECKLIST", titulo: "Documentos", prazo, alertaEm: alerta, checklistItens: ["Conferir CNPJ"] }).success).toBe(true);
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "LIGACAO", prazo, alertaEm: alerta, telefone: "11999999999" }).success).toBe(true);
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "WHATSAPP", prazo, alertaEm: alerta, contato: "Maria", mensagem: "Olá" }).success).toBe(true);
    expect(criarTarefaSchema.safeParse({ cardId, tipo: "EMAIL", titulo: "Proposta", prazo, alertaEm: alerta, emailDestino: "maria@empresa.com", mensagem: "Segue proposta" }).success).toBe(true);
  });

  it("não permite preset que crie tarefa sem prazo e alerta", () => {
    const base = {
      nome: "Retorno comercial",
      template: [{ titulo: "Retornar proposta", prazo, alertaEm: alerta }],
    };
    expect(criarTarefaPresetSchema.safeParse(base).success).toBe(true);
    expect(criarTarefaPresetSchema.safeParse({
      ...base,
      template: [{ titulo: "Retornar proposta", prazo }],
    }).success).toBe(false);
  });

  it("conecta os seis formulários e o alerta persistido no card", () => {
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx");
    const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
    const job = ler("src/lib/bpm/alertas-tarefas.ts");
    expect(painel).toContain("BPM_TAREFA_TIPOS.map");
    expect(painel).toContain('tipo === "CHECKLIST"');
    expect(painel).toContain('tipo === "LIGACAO"');
    expect(painel).toContain('tipo === "WHATSAPP"');
    expect(painel).toContain('tipo === "EMAIL"');
    expect(painel).toContain('tipo === "LEMBRETE_RAPIDO"');
    expect(painel).toContain('type="datetime-local"');
    expect(historico).toContain("<PainelTarefasPorTipo");
    expect(job).toContain("alertaDisparadoEm: null");
    expect(job).toContain('acao: "TAREFA_ALERTA_DISPARADO"');
  });
});
