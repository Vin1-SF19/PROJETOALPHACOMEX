"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar";
import {
  AtualizarMembrosCardBpm,
  ListarUsuariosVinculaveisCardBpm,
} from "@/actions/bpm/Membros";
import { cn } from "@/lib/utils";

export interface MembroCard {
  userId: number;
  role: string;
  usuario: {
    id: number;
    nome: string;
    imagemUrl: string | null;
  };
}

interface UsuarioVinculavel {
  id: number;
  nome: string;
  imagemUrl: string | null;
}

interface GrupoAvataresMembrosCardProps {
  membros: MembroCard[];
  limite?: number;
  className?: string;
}

interface SeletorMembrosCardProps {
  cardId: string;
  membros: MembroCard[];
  podeGerenciar: boolean;
  accent: string;
  onMembrosAtualizados: (membros: MembroCard[]) => void;
  onAtualizado: () => void;
}

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase() || "?";
}

function AvatarMembro({ membro, accent, className }: { membro: MembroCard; accent?: string; className?: string }) {
  return (
    <Avatar
      size="sm"
      className={cn("border border-white/15 bg-slate-800 text-[9px] font-black text-white", className)}
      title={membro.usuario.nome}
    >
      {membro.usuario.imagemUrl && (
        <AvatarImage src={membro.usuario.imagemUrl} alt={`Foto de ${membro.usuario.nome}`} className="object-cover" />
      )}
      <AvatarFallback
        className="bg-slate-800 text-[9px] font-black text-white"
        style={accent ? { background: `rgba(${accent},0.42)` } : undefined}
      >
        {iniciais(membro.usuario.nome)}
      </AvatarFallback>
    </Avatar>
  );
}

export function GrupoAvataresMembrosCard({ membros, limite = 3, className }: GrupoAvataresMembrosCardProps) {
  if (membros.length === 0) return null;

  const visiveis = membros.slice(0, limite);
  const excedente = membros.length - visiveis.length;
  const nomes = membros.map((membro) => membro.usuario.nome).join(", ");

  return (
    <AvatarGroup
      className={cn("shrink-0", className)}
      role="group"
      aria-label={`Pessoas vinculadas: ${nomes}`}
      title={`Pessoas vinculadas: ${nomes}`}
    >
      {visiveis.map((membro) => <AvatarMembro key={membro.userId} membro={membro} />)}
      {excedente > 0 && <AvatarGroupCount aria-label={`${excedente} pessoa(s) vinculada(s) adicional(is)`}>+{excedente}</AvatarGroupCount>}
    </AvatarGroup>
  );
}

export function SeletorMembrosCard({ cardId, membros, podeGerenciar, accent, onMembrosAtualizados, onAtualizado }: SeletorMembrosCardProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioVinculavel[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const membrosAtuais = membros;

  useEffect(() => {
    if (!aberto || !podeGerenciar || usuarios.length > 0) return;

    let cancelado = false;
    async function carregarUsuarios() {
      setCarregando(true);
      const resultado = await ListarUsuariosVinculaveisCardBpm({ cardId });
      if (cancelado) return;
      setCarregando(false);
      if (resultado.success) {
        setUsuarios(resultado.data);
        return;
      }
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível carregar as pessoas disponíveis.");
    }

    void carregarUsuarios();
    return () => { cancelado = true; };
  }, [aberto, cardId, podeGerenciar, usuarios.length]);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return usuarios;
    return usuarios.filter((usuario) => usuario.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, usuarios]);

  if (!podeGerenciar) {
    return <GrupoAvataresMembrosCard membros={membrosAtuais} limite={3} className="max-w-28" />;
  }

  async function alternarMembro(usuario: UsuarioVinculavel) {
    if (salvandoId !== null) return;
    const membroAtual = membrosAtuais.find((membro) => membro.userId === usuario.id);
    if (membroAtual?.role === "RESPONSAVEL") return;

    const userIds = membroAtual
      ? membrosAtuais.filter((membro) => membro.userId !== usuario.id).map((membro) => membro.userId)
      : [...membrosAtuais.map((membro) => membro.userId), usuario.id];

    setSalvandoId(usuario.id);
    try {
      const resultado = await AtualizarMembrosCardBpm({ cardId, userIds });
      if (!resultado.success) {
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível atualizar as pessoas vinculadas.");
        return;
      }

      const membrosAtualizados = resultado.data;
      if (!membrosAtualizados) {
        toast.error("A atualização não retornou as pessoas vinculadas. Recarregue o card e tente novamente.");
        return;
      }
      onMembrosAtualizados(membrosAtualizados);
      onAtualizado();
    } catch {
      toast.error("Não foi possível atualizar as pessoas vinculadas.");
    } finally {
      setSalvandoId(null);
    }
  }

  const descricao = membrosAtuais.length === 1 ? "1 pessoa vinculada" : `${membrosAtuais.length} pessoas vinculadas`;
  const popupId = `membros-card-${cardId}`;

  return (
    <div className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape") setAberto(false);
    }}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-controls={popupId}
        aria-label={podeGerenciar ? "Gerenciar pessoas vinculadas ao card" : `Pessoas vinculadas ao card: ${descricao}`}
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <Users size={14} aria-hidden="true" className="text-slate-400" />
        <span className="hidden sm:inline">Pessoas</span>
        <GrupoAvataresMembrosCard membros={membrosAtuais} limite={2} />
        <span className="text-[10px] font-extrabold tabular-nums text-slate-400">{membrosAtuais.length}</span>
      </button>

      {aberto && (
        <div
          id={popupId}
          role="dialog"
          aria-label="Pessoas vinculadas ao card"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="border-b border-white/[0.07] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">Pessoas vinculadas</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{descricao}</p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar pessoas vinculadas"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
            {podeGerenciar && (
              <label className="relative mt-3 block">
                <span className="sr-only">Buscar pessoa para vincular</span>
                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar pessoa..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                />
              </label>
            )}
          </div>

          {!podeGerenciar ? (
            <ListaMembros membros={membrosAtuais} accent={accent} />
          ) : carregando ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-400">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Carregando pessoas...
            </div>
          ) : (
            <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1.5">
              {usuariosFiltrados.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-slate-500">Nenhuma pessoa encontrada.</p>
              ) : usuariosFiltrados.map((usuario) => {
                const membro = membrosAtuais.find((item) => item.userId === usuario.id);
                const selecionado = Boolean(membro);
                const responsavel = membro?.role === "RESPONSAVEL";
                const salvando = salvandoId === usuario.id;
                return (
                  <button
                    key={usuario.id}
                    type="button"
                    role="option"
                    aria-selected={selecionado}
                    disabled={responsavel || salvandoId !== null}
                    onClick={() => void alternarMembro(usuario)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60",
                      selecionado ? "bg-white/[0.07]" : "hover:bg-white/[0.045]",
                    )}
                  >
                    <Avatar size="sm" className="border border-white/10 bg-slate-800 text-[9px] font-black text-white">
                      {usuario.imagemUrl && <AvatarImage src={usuario.imagemUrl} alt={`Foto de ${usuario.nome}`} className="object-cover" />}
                      <AvatarFallback className="bg-slate-800 text-[9px] font-black text-white" style={{ background: `rgba(${accent},0.42)` }}>
                        {iniciais(usuario.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-100">{usuario.nome}</span>
                      {responsavel && <span className="block text-[10px] text-slate-500">Responsável do card</span>}
                    </span>
                    {salvando ? <Loader2 size={15} className="animate-spin text-slate-400" aria-label="Salvando" /> : selecionado ? <Check size={16} className="text-emerald-300" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListaMembros({ membros, accent }: { membros: MembroCard[]; accent: string }) {
  if (membros.length === 0) {
    return <p className="px-4 py-8 text-center text-xs text-slate-500">Nenhuma pessoa vinculada.</p>;
  }

  return (
    <ul className="max-h-64 overflow-y-auto p-1.5" aria-label="Pessoas vinculadas">
      {membros.map((membro) => (
        <li key={membro.userId} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
          <AvatarMembro membro={membro} accent={accent} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-slate-100">{membro.usuario.nome}</span>
            <span className="block text-[10px] text-slate-500">{membro.role === "RESPONSAVEL" ? "Responsável do card" : "Participante"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
