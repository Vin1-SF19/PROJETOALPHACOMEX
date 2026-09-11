import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("experiência de feedback dos chamados", () => {
  it("preserva o toast e monta o popup somente no shell principal", () => {
    const layout = ler("src/components/layout/PainelLayoutClient.tsx");

    expect(layout).toContain("<NotificationToast");
    expect(layout).toContain("<ChamadoFinalizadoFeedbackDialog");
    expect(layout.indexOf("if (isEmbedded || role === 'TV')"))
      .toBeLessThan(layout.indexOf("<ChamadoFinalizadoFeedbackDialog"));
  });

  it("mantém o convite aberto até uma decisão explícita", () => {
    const dialog = ler("src/components/chamados/ChamadoFinalizadoFeedbackDialog.tsx");

    expect(dialog).toContain("showCloseButton={false}");
    expect(dialog).toContain("onEscapeKeyDown={(event) => event.preventDefault()}");
    expect(dialog).toContain("onPointerDownOutside={(event) => event.preventDefault()}");
    expect(dialog).toContain("recusarFeedbackChamadoAction(feedback.chamadoId)");
    expect(dialog).toContain('setEtapa("formulario")');
    expect(dialog).toContain("feedbacksPendentes[0]");
  });

  it("exibe perguntas condicionais, escalas de 0 a 5 e relato mínimo", () => {
    const formulario = ler("src/components/chamados/ChamadoFeedbackForm.tsx");
    const escala = ler("src/components/chamados/FeedbackRatingScale.tsx");

    expect(formulario).toContain("responderFeedbackChamadoSchema");
    expect(formulario).toContain('solucionadaComoEsperado === false');
    expect(formulario).toContain('solucionadaComoEsperado === true');
    expect(formulario).toContain("minLength={10}");
    expect(formulario).toContain("O tempo de resposta foi rápido?");
    expect(formulario).toContain("Sua demanda foi finalizada no tempo esperado?");
    expect(formulario).toContain("Sua demanda foi solucionada da melhor forma?");
    expect(escala).toContain("[0, 1, 2, 3, 4, 5]");
  });

  it("recupera pendências persistidas e recebe novas conclusões em tempo real", () => {
    const polling = ler("src/components/NotificacaoFlutuante.tsx");
    const realtime = ler("src/hooks/useAdminChamadosNotifications.ts");

    expect(polling).toContain("resposta.feedbacksPendentes ?? []");
    expect(polling).toContain("sincronizarFeedbacksPendentes(resposta.feedbacksPendentes ?? [])");
    expect(realtime).toContain("adicionarFeedbackPendente({");
    expect(realtime).toContain("CHAMADO_CONCLUIDO_EVENT");
  });
});

describe("abertura e detalhes do chamado", () => {
  it("lista somente técnicos ativos normalizados e mantém os novos campos opcionais", () => {
    const pagina = ler("src/app/PainelAlpha/Chamados/NovoChamado/page.tsx");
    const formulario = ler("src/app/PainelAlpha/Chamados/NovoChamado/NovoChamadoForm.tsx");

    expect(pagina).toContain('where: { status: "ATIVO" }');
    expect(pagina).toContain('isSameRole(usuario.role, "TI")');
    expect(formulario).toContain('name="tecnicoSolicitadoId"');
    expect(formulario).toContain('register("dataDesejadaConclusao")');
    expect(formulario).toContain("técnico e prazo são opcionais");
  });

  it("lê o formulário pelo alvo persistente após a validação assíncrona", () => {
    const formulario = ler("src/app/PainelAlpha/Chamados/NovoChamado/NovoChamadoForm.tsx");

    expect(formulario).toContain("const formulario = event?.target;");
    expect(formulario).not.toContain("const formulario = event?.currentTarget;");
  });

  it("mostra preferência e só oferece finalização ao técnico vinculado", () => {
    const detalhes = ler("src/components/DetalhesChamado.tsx");

    expect(detalhes).toContain("Técnico solicitado");
    expect(detalhes).toContain("Conclusão desejada");
    expect(detalhes).toContain('status === "EM_ATENDIMENTO" && tecnicoId === usuarioAtualId');
  });
});
