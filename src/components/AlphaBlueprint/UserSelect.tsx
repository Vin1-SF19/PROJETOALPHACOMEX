"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";

interface UsuarioOpcao {
  id: number;
  nome: string;
  role: string;
  status: string;
}

interface UserSelectProps {
  value?: number;
  onChange: (userId: number | undefined) => void;
  placeholder?: string;
  permitirVazio?: boolean;
}

const CACHE_USUARIOS: { dados: UsuarioOpcao[] | null } = { dados: null };

export function UserSelect({ value, onChange, placeholder = "Selecionar pessoa", permitirVazio = true }: UserSelectProps) {
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>(CACHE_USUARIOS.dados ?? []);
  const [carregando, setCarregando] = useState(!CACHE_USUARIOS.dados);

  useEffect(() => {
    if (CACHE_USUARIOS.dados) return;
    let cancelado = false;
    async function carregar() {
      const res = await BuscarTodosUsuarios();
      if (cancelado) return;
      const ativos = res.success ? res.data.filter((u) => u.status === "ATIVO") : [];
      CACHE_USUARIOS.dados = ativos;
      setUsuarios(ativos);
      setCarregando(false);
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <Select
      value={value ? String(value) : "SEM_VALOR"}
      onValueChange={(v) => onChange(v === "SEM_VALOR" ? undefined : Number(v))}
    >
      <SelectTrigger className="w-full bg-slate-900/60 border-white/10 text-white text-sm rounded-xl">
        <SelectValue placeholder={carregando ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {permitirVazio && <SelectItem value="SEM_VALOR">Não definido</SelectItem>}
        {usuarios.map((u) => (
          <SelectItem key={u.id} value={String(u.id)}>
            {u.nome} <span className="text-slate-500 text-xs">· {u.role}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
