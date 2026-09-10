"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";

const TITULOS: Record<string, string> = {
  COMPARTILHADA: "Nota compartilhada com você",
  EQUIPE: "Nota compartilhada com sua equipe",
  MENCAO: "Você foi mencionado em uma nota",
  COMENTARIO: "Novo comentário em uma nota",
  PERMISSAO_ALTERADA: "Sua permissão em uma nota mudou",
  VERSAO_RESTAURADA: "Uma versão anterior foi restaurada",
  LEMBRETE: "Lembrete de nota",
};

/**
 * Espelha o padrão de toast dedicado por domínio já usado no projeto (NotificationToast.tsx
 * de Chamados), mas via `sonner` — mesma lib já usada extensivamente pelo Sistema de Notas,
 * evitando duplicar um componente visual custom de Framer Motion para este caso mais simples.
 */
export function NotaNotificacaoToast({
  onAbrirNota,
}: {
  onAbrirNota: (noteId: string) => void;
}) {
  const notificacoes = useNotasNotificacoes((s) => s.notificacoes);
  const exibidasRef = useRef(new Set<string>());

  useEffect(() => {
    for (const notificacao of notificacoes) {
      if (exibidasRef.current.has(notificacao.id)) continue;
      exibidasRef.current.add(notificacao.id);

      toast.info(TITULOS[notificacao.tipo] ?? "Notificação de nota", {
        description: `${notificacao.autorNome} — ${notificacao.mensagem}`,
        action: {
          label: "Abrir",
          onClick: () => onAbrirNota(notificacao.noteId),
        },
      });
    }
  }, [notificacoes, onAbrirNota]);

  return null;
}
