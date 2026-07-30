"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ListarColaboradoresParaComissoes, type ColaboradorComissaoRow } from "@/actions/CommissionPositions";

const DIVERGENCIA_LABEL: Record<string, string> = {
  SEM_VINCULO_VIGENTE: "sem vínculo cadastrado",
  TIPO_NAO_RECONHECIDO: "vínculo com tipo não reconhecido",
  MULTIPLOS_VINCULOS_VIGENTES: "múltiplos vínculos simultâneos",
};

/**
 * Painel de consulta somente-leitura — cargo/setor/vínculo relevante para o cálculo de
 * comissão. Edição de cadastro continua no módulo Gestão de Colaboradores (decisão do
 * usuário: não duplicar funcionalidade aqui).
 */
export function AbaColaboradores() {
  const [colaboradores, setColaboradores] = useState<ColaboradorComissaoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarColaboradoresParaComissoes();
    if (resultado.success) {
      setColaboradores(resultado.data);
      setErro(null);
    } else {
      setErro(resultado.error);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const filtrados = colaboradores.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));

  if (carregando) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
        Não foi possível carregar os colaboradores. <code className="text-xs">{erro}</code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Consulta de cargo/setor/vínculo relevante para o cálculo de comissão. Para editar o
        cadastro de um colaborador, use o módulo Gestão de Colaboradores.
      </p>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome..."
        className="w-full rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
      />

      {filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum colaborador encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((colaborador) => (
            <div key={colaborador.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3">
              <div>
                <p className="text-sm font-medium text-white">{colaborador.nome}</p>
                <p className="text-xs text-slate-500">
                  {colaborador.cargo ?? "Sem cargo"} · {colaborador.setorNome ?? "Sem setor"}
                </p>
              </div>
              <span className={colaborador.vinculo ? "text-xs text-slate-300" : "text-xs italic text-slate-600"}>
                {colaborador.vinculo ?? DIVERGENCIA_LABEL[colaborador.vinculoDivergente ?? ""] ?? "Não Atribuído"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
