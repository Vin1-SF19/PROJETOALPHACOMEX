import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trigger = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pusher-server.ts", () => ({
  pusherServer: { trigger },
}));

import {
  NOTA_COMPARTILHADA_EVENT,
  NOTA_NOTIFICACAO_EVENTS,
} from "@/lib/notas/notificacoes";
import { notificarUsuarioNota } from "@/lib/notas/notificacoes-server";

function ler(caminho: string): string {
  return readFileSync(resolve(process.cwd(), caminho), "utf8");
}

const payload = {
  noteId: "nota-42",
  noteTitle: "Plano comercial",
  tipo: "COMPARTILHADA" as const,
  mensagem: "compartilhou a nota com você",
  autorNome: "Ana",
  createdAt: "2026-09-10T12:00:00.000Z",
};

describe("notificações de notas na central global", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trigger.mockResolvedValue(undefined);
  });

  it("publica compartilhamento no canal privado do destinatário", async () => {
    await expect(
      notificarUsuarioNota(17, NOTA_COMPARTILHADA_EVENT, payload),
    ).resolves.toBe(true);

    expect(trigger).toHaveBeenCalledWith(
      "private-notas-usuario-17",
      NOTA_COMPARTILHADA_EVENT,
      payload,
    );
  });

  it("não desfaz a origem quando o realtime falha ou o destinatário é inválido", async () => {
    trigger.mockRejectedValueOnce(new Error("indisponível"));

    await expect(
      notificarUsuarioNota(17, NOTA_COMPARTILHADA_EVENT, payload),
    ).resolves.toBe(false);
    await expect(
      notificarUsuarioNota(0, NOTA_COMPARTILHADA_EVENT, payload),
    ).resolves.toBe(false);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("mantém todos os eventos do domínio no mesmo contrato da central", () => {
    expect(NOTA_NOTIFICACAO_EVENTS).toEqual([
      "nota-compartilhada",
      "nota-mencao",
      "nota-comentario",
      "nota-permissao-alterada",
      "nota-versao-restaurada",
      "nota-lembrete",
    ]);
  });

  it("declara o compartilhamento por equipe no payload oficial", () => {
    const contrato = ler("src/lib/notas/notificacoes.ts");
    const toast = ler("src/components/Notas/NotaNotificacaoToast.tsx");

    expect(contrato).toContain('| "EQUIPE"');
    expect(toast).toContain('EQUIPE: "Nota compartilhada com sua equipe"');
  });

  it("publica compartilhamentos diretos e de equipe pelo serviço oficial", () => {
    const colaboracao = ler("src/actions/NotasColaboracao.ts");
    const equipes = ler("src/actions/NotasEquipes.ts");

    expect(colaboracao).toContain(
      "notificarUsuarioNota(destinatarioId, NOTA_COMPARTILHADA_EVENT",
    );
    expect(equipes).toContain(
      "notificarUsuarioNota(userId as number, NOTA_COMPARTILHADA_EVENT",
    );
    expect(colaboracao).not.toContain('notificar(destinatarioId, "nota-compartilhada"');
    expect(equipes).not.toContain('pusherServer.trigger(canalNotasDoUsuario');
  });

  it("assina somente no shell e libera a trava para uma nova assinatura", () => {
    const hook = ler("src/hooks/useNotasNotifications.ts");

    expect(hook).toContain("window !== window.top");
    expect(hook).toContain("for (const evento of NOTA_NOTIFICACAO_EVENTS)");
    expect(hook).toContain("subscribedRef.current = false");
  });

  it("agrega notas e abre toast e item pela navegação interna do painel", () => {
    const central = ler("src/components/layout/CentralNotificacoesPainel.tsx");
    const toast = ler("src/components/Notas/NotaNotificacaoToast.tsx");
    const shell = ler("src/components/layout/PainelLayoutClient.tsx");

    expect(central).toContain("...notas.notificacoes.map");
    expect(central).toContain("abrir: () => onAbrirNota(notificacao.noteId)");
    expect(toast).toContain("onClick: () => onAbrirNota(notificacao.noteId)");
    expect(toast).not.toContain("useRouter");
    expect(shell).toContain("openTab(`/PainelAlpha/Notas?id=${encodeURIComponent(noteId)}`");
    expect(shell).toContain("<NotaNotificacaoToast onAbrirNota={abrirNotasPorNotificacao} />");
    expect(shell).toContain("onAbrirNota={abrirNotasPorNotificacao}");
  });
});
