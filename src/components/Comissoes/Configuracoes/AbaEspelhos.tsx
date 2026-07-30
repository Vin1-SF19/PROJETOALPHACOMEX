"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatarDataComissao } from "../lib/formatters";
import { ListarExportDocuments } from "@/actions/CommissionExports";

interface ExportDocumentRow {
  id: string;
  tipo: string;
  colaboradorId: number | null;
  periodoInicio: Date;
  periodoFim: Date;
  formato: string;
  codigoVerificacao: string;
  geradoPorNome: string | null;
  createdAt: Date;
}

const TIPO_LABEL: Record<string, string> = {
  comissoes: "Comissões",
  premios: "Prêmios",
  comissao_dsr: "Comissão + DSR",
  todos: "Todos",
};

/**
 * Histórico de espelhos gerados — somente leitura. O arquivo binário (PDF/XLSX) não é
 * armazenado, só o registro de auditoria (quem gerou, quando, código de verificação) —
 * por isso não há botão de "baixar de novo" aqui; para obter o arquivo, gere um novo
 * espelho pelo botão "Exportar Espelho" no cabeçalho.
 */
export function AbaEspelhos() {
  const [documentos, setDocumentos] = useState<ExportDocumentRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarExportDocuments({ page: 1, pageSize: 25 });
    if (resultado.success) {
      setDocumentos(resultado.data as unknown as ExportDocumentRow[]);
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
        Não foi possível carregar o histórico de espelhos. <code className="text-xs">{erro}</code>
      </div>
    );
  }

  if (documentos.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhum espelho exportado ainda.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Histórico de auditoria dos espelhos já gerados. O arquivo não fica salvo aqui — use o
        botão &quot;Exportar Espelho&quot; no cabeçalho para gerar um novo.
      </p>

      {documentos.map((doc) => (
        <div key={doc.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</p>
            <span className="text-xs text-slate-500">{formatarDataComissao(doc.createdAt)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {formatarDataComissao(doc.periodoInicio)} — {formatarDataComissao(doc.periodoFim)} · {doc.formato}
            {doc.geradoPorNome && ` · gerado por ${doc.geradoPorNome}`}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-600">Código de verificação: {doc.codigoVerificacao}</p>
        </div>
      ))}
    </div>
  );
}
