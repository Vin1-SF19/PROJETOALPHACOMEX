"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, UsersRound, ArrowUpRight, ClipboardCheck, SlidersHorizontal, History } from "lucide-react";
import { motion } from "framer-motion";
import { listarAnalistasChecklist, listarEmpresasChecklist } from "@/actions/checklist";
import { confirmar } from "@/lib/checklist/client/types";
import { formatCNPJ } from "@/lib/format-cnpj";
import { tiposChecklist } from "@/lib/checklist/schemas";
import { TIPO_LABELS } from "@/lib/checklist/items";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AnalistasSidebar } from "@/components/checklist/AnalistasSidebar";
import { Acao, Carregando, Falha, Paginas, Percentual, campoChecklist } from "@/components/checklist/ChecklistUI";
import { NovoAtendimentoDialog } from "@/components/checklist/NovoAtendimentoDialog";
interface Props {
  canCreate: boolean;
  canAssign: boolean;
}
export default function ListaChecklist({ canCreate, canAssign }: Props) {
  const [analistaId, setAnalista] = useState<number | null>(null),
    [busca, setBusca] = useState(""),
    [tipo, setTipo] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [semAnalista, setSemAnalista] = useState(false),
    [novo, setNovo] = useState(false),
    [mobile, setMobile] = useState(false);
  const analistas = useQuery({ queryKey: ["checklist-analistas"], queryFn: () => confirmar(listarAnalistasChecklist()) });
  const empresas = useQuery({
    queryKey: ["checklist-empresas", analistaId, busca, tipo, status, semAnalista, page],
    queryFn: () =>
      confirmar(
        listarEmpresasChecklist({
          analistaId: analistaId ?? undefined,
          busca: busca || undefined,
          tipo: tipo || undefined,
          status: status || undefined,
          semAnalista: semAnalista || undefined,
          page,
          pageSize: 12,
        }),
      ),
  });
  const selecionar = (id: number | null) => {
    setAnalista(id);
    setPage(1);
    setSemAnalista(false);
    setMobile(false);
  };
  const nome = analistaId === null ? "Todos os analistas" : (analistas.data?.find((a) => a.id === analistaId)?.nome ?? "Analista");
  const sidebar = analistas.isPending ? (
    <Carregando />
  ) : analistas.isError ? (
    <Falha error={analistas.error} retry={() => void analistas.refetch()} />
  ) : (
    <AnalistasSidebar analistas={analistas.data} selecionado={analistaId} onSelect={selecionar} />
  );
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-7 text-slate-100 sm:px-7 lg:px-9">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Operacional / Documentação</p>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <ClipboardCheck className="text-[var(--checklist-accent)]" />
            Checklist RADAR
          </h1>
          <p className="mt-2 text-sm text-slate-400">Uma visão clara das empresas, documentos e responsáveis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/PainelAlpha/CheckList/Historico">
            <Acao>
              <History size={15} />
              Histórico
            </Acao>
          </Link>
          <Link href="/PainelAlpha/CheckList/Embasamentos">
            <Acao>
              <SlidersHorizontal size={15} />
              Modelos
            </Acao>
          </Link>
          {canCreate && (
            <Acao onClick={() => setNovo(true)} className="bg-[var(--checklist-accent)] text-white">
              <Plus size={16} />
              Novo atendimento
            </Acao>
          )}
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="hidden self-start rounded-3xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl lg:sticky lg:top-6 lg:block">
          {sidebar}
        </aside>
        <section className="min-w-0">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{nome}</h2>
              <p className="mt-1 text-xs text-slate-400">
                {empresas.data ? `${empresas.data.totalCount} ${empresas.data.totalCount === 1 ? "atendimento" : "atendimentos"}` : "Carregando atendimentos…"}{" "}
                · mais recentes primeiro
              </p>
            </div>
            <Sheet open={mobile} onOpenChange={setMobile}>
              <SheetTrigger asChild>
                <Acao className="lg:hidden">
                  <UsersRound size={16} />
                  Analistas
                </Acao>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto border-white/10 bg-slate-950 p-5 text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">Equipe operacional</SheetTitle>
                </SheetHeader>
                {sidebar}
              </SheetContent>
            </Sheet>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="text-xs text-slate-400">
              Buscar empresa
              <input
                className={campoChecklist + " mt-1"}
                value={busca}
                maxLength={200}
                placeholder="Nome ou CNPJ"
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="text-xs text-slate-400">
              Embasamento
              <select
                className={campoChecklist + " mt-1"}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os tipos</option>
                {tiposChecklist.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Status
              <select
                className={campoChecklist + " mt-1"}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os status</option>
                {["ATIVO", "EM_ANDAMENTO", "CONCLUIDO", "INATIVO"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {canAssign && (
              <label className="flex items-center gap-2 self-end py-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={semAnalista}
                  onChange={(e) => {
                    setSemAnalista(e.target.checked);
                    setAnalista(null);
                    setPage(1);
                  }}
                />
                Pendentes de atribuição
              </label>
            )}
          </form>
          {empresas.isPending ? (
            <Carregando />
          ) : empresas.isError ? (
            <Falha error={empresas.error} retry={() => void empresas.refetch()} />
          ) : (
            <>
              {empresas.data.items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-slate-400">
                  <ClipboardCheck size={30} className="mx-auto mb-4 opacity-50" />
                  Nenhuma empresa nesta visualização.<p className="mt-2 text-xs">Altere os filtros ou crie um atendimento autorizado.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {empresas.data.items.map((e, i) => (
                    <motion.article
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 5) * 0.025 }}
                      key={e.id}
                      className="group rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition hover:border-white/20"
                    >
                      <div className="mb-5 flex justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{e.razaoSocial}</h3>
                          <p className="mt-1 text-xs text-slate-400">{formatCNPJ(e.cnpj) || "CNPJ não informado"}</p>
                        </div>
                        <span className="h-fit shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-300">{e.status}</span>
                      </div>
                      <Percentual
                        percentual={e.resumo.percentual}
                        descricao={
                          e.resumo.estado === "SEM_CHECKLIST" ? "Embasamento a definir" : `${e.resumo.concluidos}/${e.resumo.total} obrigatórios concluídos`
                        }
                      />
                      <dl className="my-5 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="mb-1 text-slate-500">Analista</dt>
                          <dd className="text-slate-300">{e.analista?.nome ?? "Aguardando atribuição"}</dd>
                        </div>
                        <div>
                          <dt className="mb-1 text-slate-500">Embasamento</dt>
                          <dd className="text-slate-300">{e.tipoAtivo ? TIPO_LABELS[e.tipoAtivo] : "Não definido"}</dd>
                        </div>
                      </dl>
                      <div className="flex items-center justify-between border-t border-white/10 pt-4">
                        <span className="text-xs text-slate-400">{e.capabilities.canEdit ? "Pode editar" : "Somente leitura"}</span>
                        <Link
                          href={`/PainelAlpha/CheckList/${e.id}`}
                          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]"
                        >
                          Abrir checklist
                          <ArrowUpRight size={16} />
                        </Link>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
              <Paginas page={page} pageSize={empresas.data.pageSize} total={empresas.data.totalCount} onPage={setPage} />
            </>
          )}
        </section>
      </div>
      {novo && (
        <NovoAtendimentoDialog
          onClose={() => setNovo(false)}
          analistas={analistas.data ?? []}
          canAssign={canAssign}
          onCreated={() => {
            void empresas.refetch();
            void analistas.refetch();
          }}
        />
      )}
    </main>
  );
}
