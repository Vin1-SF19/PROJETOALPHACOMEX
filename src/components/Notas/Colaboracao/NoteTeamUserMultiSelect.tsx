"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { BuscarUsuariosParaEquipeNota } from "@/actions/NotasEquipes";
import type { RolePermissaoNota } from "@/lib/validations/notas";

export interface UsuarioEquipeSelecionado {
  userId: number;
  nome: string;
  role: RolePermissaoNota;
}

interface UsuarioEncontrado {
  id: number;
  nome: string;
  role: string;
  imagemUrl: string | null;
}

interface Props {
  value: UsuarioEquipeSelecionado[];
  onChange: (value: UsuarioEquipeSelecionado[]) => void;
  excludeIds?: number[];
}

const PAPEIS: RolePermissaoNota[] = ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"];

export function NoteTeamUserMultiSelect({ value, onChange, excludeIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<UsuarioEncontrado[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) return;
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      const res = await BuscarUsuariosParaEquipeNota(termo);
      if (!cancelado) {
        setCarregando(false);
        setResultados(res.success ? res.data : []);
      }
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const idsBloqueados = new Set([...excludeIds, ...value.map((usuario) => usuario.userId)]);
  const disponiveis = resultados.filter((usuario) => !idsBloqueados.has(usuario.id));

  function adicionar(usuario: UsuarioEncontrado) {
    onChange([...value, { userId: usuario.id, nome: usuario.nome, role: "LEITOR" }]);
    setQuery("");
    setResultados([]);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
        <input
          value={query}
          onChange={(event) => {
            const valor = event.target.value;
            setQuery(valor);
            if (valor.trim().length < 2) setResultados([]);
          }}
          placeholder="Digite o nome do colaborador..."
          aria-label="Pesquisar colaboradores"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
        />
      </div>

      {(query.trim().length >= 2 || carregando) && (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1120] p-1 shadow-2xl">
          {carregando && <p className="px-3 py-2 text-xs text-slate-500">Pesquisando...</p>}
          {!carregando && disponiveis.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">Nenhum colaborador disponível.</p>
          )}
          {disponiveis.map((usuario) => (
            <button
              key={usuario.id}
              type="button"
              onClick={() => adicionar(usuario)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-300">
                {usuario.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-200">{usuario.nome}</span>
                <span className="block truncate text-[11px] text-slate-500">{usuario.role}</span>
              </span>
              <UserPlus size={14} className="text-cyan-400" />
            </button>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((usuario) => (
            <div key={usuario.userId} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-2">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{usuario.nome}</span>
              <select
                value={usuario.role}
                aria-label={`Função de ${usuario.nome}`}
                onChange={(event) =>
                  onChange(
                    value.map((item) =>
                      item.userId === usuario.userId
                        ? { ...item, role: event.target.value as RolePermissaoNota }
                        : item,
                    ),
                  )
                }
                className="rounded-lg border border-white/10 bg-[#111827] px-2 py-1 text-[11px] text-slate-300 outline-none"
              >
                {PAPEIS.map((papel) => <option key={papel}>{papel}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Remover ${usuario.nome} da seleção`}
                onClick={() => onChange(value.filter((item) => item.userId !== usuario.userId))}
                className="rounded-md p-1 text-slate-500 hover:bg-rose-400/10 hover:text-rose-400"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
