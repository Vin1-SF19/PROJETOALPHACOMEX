"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import type { obterVideoIntrodutorioConfig } from "@/actions/video-introdutorio";
import { ModalVideoIntrodutorioAdmin } from "./ModalVideoIntrodutorioAdmin";
import { ModalVideoIntrodutorioUsuario } from "./ModalVideoIntrodutorioUsuario";

type ConfigInicial = Awaited<ReturnType<typeof obterVideoIntrodutorioConfig>>["data"];

interface BotaoVideoIntrodutorioProps {
  modulo: string;
  isAdmin: boolean;
  configInicial: ConfigInicial;
  /**
   * Notifica o pai quando o modal (Admin ou usuário) abre/fecha — usado para
   * pausar animações pesadas de fundo (ex: `AnimatedShaderBackground`) que
   * competem por GPU com o decode do `<video>` e causam frame congelado.
   */
  aoAlternarModal?: (aberto: boolean) => void;
}

/**
 * Botão "Vídeo Introdutório" reutilizável entre módulos (ver decisions.md,
 * 2026-07-14). Regra de visibilidade:
 * - Admin: SEMPRE aparece (mesmo sem config, ou config expirada).
 * - Não-Admin: só aparece se houver config ativa e não expirada.
 */
export function BotaoVideoIntrodutorio({ modulo, isAdmin, configInicial, aoAlternarModal }: BotaoVideoIntrodutorioProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const config = configInicial;

  const visivelParaNaoAdmin = !!config && !config.expirado;

  if (!isAdmin && !visivelParaNaoAdmin) return null;

  const abrirModal = () => {
    setModalOpen(true);
    aoAlternarModal?.(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    aoAlternarModal?.(false);
  };

  const recarregar = () => {
    // O Server Action já chama revalidatePath (invalida o cache do Next),
    // mas o Client Component só recebe a config nova via re-render vindo do
    // servidor — router.refresh() busca o Server Component de novo com os
    // dados atualizados (mesmo padrão de ParceirosClient.tsx).
    router.refresh();
  };

  return (
    <>
      <button
        onClick={abrirModal}
        title="Vídeo Introdutório"
        className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-slate-100 hover:brightness-110"
        style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)" }}
      >
        <PlayCircle size={15} />
        Vídeo Introdutório
      </button>

      {isAdmin ? (
        <ModalVideoIntrodutorioAdmin
          open={modalOpen}
          onClose={fecharModal}
          modulo={modulo}
          configAtual={config}
          aoAtivar={recarregar}
        />
      ) : (
        config && (
          <ModalVideoIntrodutorioUsuario
            open={modalOpen}
            onClose={fecharModal}
            videoUrl={config.videoUrl}
            videoTitulo={config.videoTitulo}
          />
        )
      )}
    </>
  );
}
