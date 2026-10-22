"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listarHistoricoDocumentosChecklist } from "@/actions/checklist";
import { confirmar } from "@/lib/checklist/client/types";
import { TIPO_LABELS } from "@/lib/checklist/items";
import { Carregando, Falha, Paginas } from "@/components/checklist/ChecklistUI";
export default function HistoricoClient() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["checklist-historico-documentos", page],
    queryFn: () => confirmar(listarHistoricoDocumentosChecklist({ page, pageSize: 20 })),
  });
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
      <Link href="/PainelAlpha/CheckList" className="text-sm text-slate-400">
        ← Empresas e analistas
      </Link>
      <h1 className="text-2xl font-semibold">Histórico de documentos removidos</h1>
      <p className="text-sm text-slate-400">
        Os registros preservam a origem do envio e o responsável pela remoção. O histórico completo de alterações está dentro do atendimento.
      </p>
      {query.isPending ? (
        <Carregando />
      ) : query.isError ? (
        <Falha error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.items.length && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-slate-400">Nenhum documento removido.</p>}
          <div className="space-y-3">
            {query.data.items.map((d) => (
              <article key={d.id} className="rounded-2xl border border-white/10 bg-slate-950/75 p-5">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                  {d.nome}
                </a>
                <Link
                  className="mt-2 block text-sm text-slate-300"
                  href={`/PainelAlpha/CheckList/${d.empresaId}?checklistId=${encodeURIComponent(d.checklistId)}`}
                >
                  {d.razaoSocial}
                </Link>
                <p className="mt-2 text-xs text-slate-400">
                  {TIPO_LABELS[d.tipo]} · {d.itemCodigo} · {d.itemDescricao}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Removido por{" "}
                  {d.deletadoPorUsuarioId
                    ? `usuário #${d.deletadoPorUsuarioId}`
                    : d.deletadoPorContaId
                      ? "cliente do portal"
                      : "origem legada não identificada"}{" "}
                  · {d.deletadoEm ? new Date(d.deletadoEm).toLocaleString("pt-BR") : "Data não informada"}
                </p>
              </article>
            ))}
          </div>
          <Paginas page={page} pageSize={20} total={query.data.totalCount} onPage={setPage} />
        </>
      )}
    </main>
  );
}
