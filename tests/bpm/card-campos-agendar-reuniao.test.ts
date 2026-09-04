import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("BPM - card restrito na etapa Agendar reunião", () => {
  const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
  const cardsAction = ler("src/actions/bpm/Cards.ts");
  const painelReuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");

  it("carrega os dados canônicos da reunião no payload do Kanban", () => {
    expect(cardsAction).toContain("dataReuniao: true");
    expect(cardsAction).toContain("googleMeetLink: true");
    expect(cardsAction).toContain("dataReuniao: null");
    expect(cardsAction).toContain("googleMeetLink: null");
  });

  it("renderiza somente Data e hora e a ação Meet no ramo da etapa", () => {
    const ramoAgendar = board.slice(
      board.indexOf("{agendarReuniao && !ehLeadVirtual ? ("),
      board.indexOf("          ) : (\n            <>", board.indexOf("{agendarReuniao && !ehLeadVirtual ? (")),
    );

    expect(board).toContain("const agendarReuniao = etapaEhAgendarReuniao(etapaNome)");
    expect(ramoAgendar).toContain("Data e hora");
    expect(ramoAgendar).toContain("card.dataReuniao");
    expect(ramoAgendar).toContain("Agendar pelo Google Meet");
    expect(ramoAgendar).not.toContain("BadgeProximoContato");
    expect(ramoAgendar).not.toContain("GrupoAvataresMembrosCard");
    expect(ramoAgendar).not.toContain("anotacaoRapidaPendente");
  });

  it("abre o formulário sem link e abre o Meet existente em nova aba", () => {
    expect(board).toContain("card.googleMeetLink ? (");
    expect(board).toContain("href={card.googleMeetLink}");
    expect(board).toContain('target="_blank"');
    expect(board).toContain("Abrir Google Meet");
    expect(board).toContain("onAbrir(card.id)");
    expect(board).toContain("onPointerDown={(event) => event.stopPropagation()}");
  });

  it("preserva o agendamento real, loading e feedback de sucesso ou erro no modal", () => {
    expect(painelReuniao).toContain("AgendarReuniaoGoogleMeetBpm(dados)");
    expect(painelReuniao).toContain("disabled={!podeEditar || salvando");
    expect(painelReuniao).toContain('toast.success(jaAgendada ? "Reunião reagendada" : "Reunião agendada no Google Meet")');
    expect(painelReuniao).toContain('toast.error(typeof res.error === "string" ? res.error : "Não foi possível salvar a reunião")');
  });

  it("mantém a renderização padrão como ramo alternativo", () => {
    expect(board).toContain("!novosLeads && canalOrigem");
    expect(board).toContain("!novosLeads && proximaTarefaComPrazo");
    expect(board).toContain("<GrupoAvataresMembrosCard");
  });
});
