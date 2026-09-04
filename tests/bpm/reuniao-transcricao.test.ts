import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");
const slot = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx");
const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");
const action = ler("src/actions/bpm/TranscricaoMeet.ts");
const googleMeet = ler("src/actions/bpm/GoogleMeet.ts");

describe("RM-2026-CB55AA — transcrição da reunião no card", () => {
  it("entrega o painel em Reunião Agendada sem formulário de agendamento", () => {
    expect(slot).toContain("etapaEhReuniaoAgendada(card.etapa.nome)");
    expect(slot).toContain("mostrarFormulario={false}");
  });

  it("exibe resumo editável e registra o autosave no fluxo do card", () => {
    expect(painel).toContain('aria-label="Resumo da reunião"');
    expect(painel).toContain("onBlur={() => void persistirResumo()}");
    expect(painel).toContain("return registerSave(async () =>");
  });

  it("trata busca, atualização e estado pendente da transcrição", () => {
    expect(painel).toContain('"Buscar transcrição"');
    expect(painel).toContain('"Atualizar transcrição"');
    expect(painel).toContain("Transcrição ainda não disponível");
  });

  it("exibe data da reunião e estado vazio explícito no acompanhamento", () => {
    expect(painel).toContain("Data da reunião:");
    expect(painel).toContain("Nenhuma reunião vinculada a este card");
    expect(painel).toContain("Transcrição ainda não disponível — tente novamente em alguns minutos");
  });

  it("protege a persistência manual com sessão, Zod, ownership e CAS", () => {
    expect(action).toContain("salvarResumoSchema.safeParse(dados)");
    expect(action).toContain("await exigirAcessoBpmCard(cardId, userId");
    expect(action).toContain("updatedAt: versaoEsperadaEm");
  });

  it("mantém o vínculo Google e o contrato completo de criação do evento", () => {
    expect(googleMeet).toContain("googleEventId: resultado.data.googleEventId");
    expect(googleMeet).toContain('eventType: "default"');
    expect(googleMeet).toContain('visibilidade: "default"');
    expect(googleMeet).toContain('transparencia: "opaque"');
    expect(googleMeet).toContain("lembretesMinutos: []");
  });
});
