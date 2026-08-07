"use client";

import { useEffect, useState } from "react";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";

interface UsuarioOpcao {
  id: number;
  nome: string;
  role: string;
}

interface UserSearchSelectProps {
  onSelecionar: (usuario: UsuarioOpcao) => void;
  excluirIds?: number[];
}

export function UserSearchSelect({ onSelecionar, excluirIds = [] }: UserSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);

  useEffect(() => {
    async function carregar() {
      const res = await BuscarTodosUsuarios();
      if (res.success) {
        setUsuarios(res.data.filter((u) => u.status === "ATIVO"));
      }
    }
    void carregar();
  }, []);

  const filtrados = usuarios
    .filter((u) => !excluirIds.includes(u.id))
    .filter((u) => u.nome.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar usuário por nome..."
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
      />
      {query.trim().length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0b1120]">
          {filtrados.map((usuario) => (
            <button
              key={usuario.id}
              type="button"
              onClick={() => {
                onSelecionar(usuario);
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
            >
              <span>{usuario.nome}</span>
              <span className="text-[10px] text-slate-600">{usuario.role}</span>
            </button>
          ))}
          {filtrados.length === 0 && <p className="px-3 py-2 text-xs text-slate-600">Nenhum usuário encontrado.</p>}
        </div>
      )}
    </div>
  );
}
