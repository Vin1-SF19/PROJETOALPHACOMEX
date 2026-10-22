"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obterHistoricoChecklist } from "@/actions/checklist";
import { confirmar } from "@/lib/checklist/client/types";
import { Carregando, Falha, Paginas } from "./ChecklistUI";
export function HistoricoAtendimento({ empresaId }: { empresaId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["checklist-journal", empresaId, page],
    queryFn: () => confirmar(obterHistoricoChecklist({ empresaId, page, pageSize: 20 })),
  });
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
      <h2 className="mb-4 font-semibold">Histórico do atendimento</h2>
      {query.isPending ? (
        <Carregando />
      ) : query.isError ? (
        <Falha error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.items.length && <p className="text-sm text-slate-400">Nenhum evento registrado.</p>}
          <ol className="space-y-3">
            {query.data.items.map((e) => (
              <li key={e.id} className="border-l border-white/15 pl-4 text-sm">
                <p>{e.tipo.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(e.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {e.atorTipo === "INTERNO" ? `Usuário #${e.atorUsuarioId}` : e.atorTipo === "PORTAL" ? "Cliente do portal" : "Sistema"} · revisão {e.revision}
                </p>
              </li>
            ))}
          </ol>
          <Paginas page={page} pageSize={20} total={query.data.totalCount} onPage={setPage} />
        </>
      )}
    </section>
  );
}
