"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { ListarServicosComTarifario, type ServicoComTarifarioRow } from "@/actions/CommissionTariffs";

/**
 * Catálogo Alpha usado nos seletores de serviço do cadastro comercial, combinado com os
 * serviços personalizados persistidos em ServicosComerciais.
 */
export function AbaServicos() {
  const [servicos, setServicos] = useState<ServicoComTarifarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarServicosComTarifario();
    if (resultado.success) {
      setServicos(resultado.data);
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
        Não foi possível carregar os serviços. <code className="text-xs">{erro}</code>
      </div>
    );
  }

  if (servicos.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Não foi possível montar o catálogo de serviços.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Mesmo catálogo exibido em &quot;Selecionar Serviço&quot; ao registrar um cliente, incluindo
        os serviços padrão da Alpha e os adicionados por &quot;Novo Serviço&quot;. Para cadastrar
        preços, use &quot;Tarifários&quot;.
      </p>

      {servicos.map((servico) => (
        <div key={servico.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3">
          <div>
            <p className={`text-sm font-medium ${servico.ativo ? "text-white" : "text-slate-600"}`}>
              {servico.nome}
              {!servico.ativo && " (inativo)"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {servico.origem === "PADRAO" ? "Serviço padrão Alpha" : "Serviço personalizado"}
            </p>
          </div>
          {servico.temTarifarioVigente ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Tarifário cadastrado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Sem tarifário
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
