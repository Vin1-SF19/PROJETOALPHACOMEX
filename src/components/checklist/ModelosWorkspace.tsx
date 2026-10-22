"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listarModelosChecklist, publicarModeloChecklist, desativarModeloChecklist, ordenarModelosChecklist } from "@/actions/checklist-modelos";
import { confirmar, type Dados } from "@/lib/checklist/client/types";
import { tiposChecklist } from "@/lib/checklist/schemas";
import { TIPO_LABELS, SECOES } from "@/lib/checklist/items";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Acao, Carregando, Falha, Paginas, campoChecklist } from "./ChecklistUI";
import { useChecklistCommand } from "./useChecklistCommand";
type Modelo = Dados<Awaited<ReturnType<typeof listarModelosChecklist>>>["items"][number];
export function ModelosWorkspace({ canManage, tipoInicial = "" }: { canManage: boolean; tipoInicial?: string }) {
  const [tipo, setTipo] = useState(tipoInicial),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Modelo | null | undefined>(),
    command = useChecklistCommand();
  const query = useQuery({
    queryKey: ["checklist-modelos", tipo, page],
    queryFn: () => confirmar(listarModelosChecklist({ ...(tipo === "GLOBAL" ? { escopo: "GLOBAL" } : tipo ? { tipo } : {}), page, pageSize: 20 })),
  });
  async function revisar(modelo: Modelo, ordem?: number) {
    const data = await command.run(`${modelo.id}:${modelo.revision}:${ordem ?? "desativar"}`, (mutationId) =>
      ordem === undefined
        ? desativarModeloChecklist({ identidadeId: modelo.id, expectedRevision: modelo.revision, mutationId })
        : ordenarModelosChecklist({ identidadeId: modelo.id, expectedRevision: modelo.revision, mutationId, ordem }),
    );
    if (data) await query.refetch();
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
      <Link href="/PainelAlpha/CheckList" className="text-sm text-slate-400">
        ← Empresas e analistas
      </Link>
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Modelos de embasamento</h1>
          <p className="mt-2 text-sm text-slate-400">
            Versões publicadas valem somente para novos checklists. Os documentos e snapshots existentes são preservados.
          </p>
        </div>
        {canManage && <Acao onClick={() => setEdit(null)}>Novo documento do modelo</Acao>}
      </header>
      {!canManage && (
        <p className="rounded-xl border border-white/10 p-3 text-xs text-slate-400">
          Consulta do catálogo. Publicação e gestão exclusivas do Líder Operacional.
        </p>
      )}
      <label className="block max-w-sm text-xs text-slate-400">
        Filtrar escopo
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setPage(1);
          }}
          className={campoChecklist + " mt-1"}
        >
          <option value="">Todos os modelos</option>
          <option value="GLOBAL">Somente globais</option>
          {tiposChecklist.map((t) => (
            <option key={t} value={t}>
              {TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {command.error && <Falha error={command.error} />}
      {query.isPending ? (
        <Carregando />
      ) : query.isError ? (
        <Falha error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.items.length && (
            <p className="rounded-2xl border border-dashed border-white/15 p-10 text-slate-400">Nenhum modelo publicado neste escopo.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.items.map((m) => (
              <article key={m.id} className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/75 p-5">
                <div className="flex justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {m.escopo === "GLOBAL" ? "Global" : m.escopo} · {m.codigo}
                  </span>
                  <span>
                    v{m.modelo?.versao ?? 0} · {m.modelo?.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <h2 className="font-semibold">{m.modelo?.nome ?? "Identidade sem revisão"}</h2>
                <p className="text-sm text-slate-400">{m.modelo?.descricao}</p>
                <p className="text-xs text-slate-500">
                  {m.modelo?.secao} · {m.modelo?.obrigatorio ? "Obrigatório" : "Condicional"} · ordem {m.modelo?.ordem ?? 0}
                </p>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Acao disabled={command.busy} onClick={() => setEdit(m)}>
                      Editar / publicar versão
                    </Acao>
                    {m.modelo?.ativo && (
                      <Acao disabled={command.busy} onClick={() => void revisar(m)}>
                        Desativar
                      </Acao>
                    )}
                    <Acao
                      aria-label={`Subir ${m.codigo}`}
                      disabled={command.busy || !m.modelo}
                      onClick={() => void revisar(m, Math.max(0, (m.modelo?.ordem ?? 0) - 1))}
                    >
                      ↑ Ordem
                    </Acao>
                    <Acao aria-label={`Descer ${m.codigo}`} disabled={command.busy || !m.modelo} onClick={() => void revisar(m, (m.modelo?.ordem ?? 0) + 1)}>
                      ↓ Ordem
                    </Acao>
                  </div>
                )}
              </article>
            ))}
          </div>
          <Paginas page={page} pageSize={20} total={query.data.totalCount} onPage={setPage} />
        </>
      )}
      {edit !== undefined && (
        <ModeloDialog
          modelo={edit}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            setEdit(undefined);
            void query.refetch();
          }}
        />
      )}
    </main>
  );
}
function ModeloDialog({ modelo, onClose, onSaved }: { modelo: Modelo | null; onClose: () => void; onSaved: () => void }) {
  const [escopo, setEscopo] = useState(modelo?.escopo ?? "GLOBAL"),
    [codigo, setCodigo] = useState(modelo?.codigo ?? ""),
    [nome, setNome] = useState(modelo?.modelo?.nome ?? ""),
    [descricao, setDescricao] = useState(modelo?.modelo?.descricao ?? ""),
    [secao, setSecao] = useState<string>(modelo?.modelo?.secao ?? SECOES.CONSTITUICAO),
    [obrigatorio, setObrigatorio] = useState(modelo?.modelo?.obrigatorio ?? true),
    [ordem, setOrdem] = useState(modelo?.modelo?.ordem ?? 0),
    [ativo, setAtivo] = useState(modelo?.modelo?.ativo ?? true),
    command = useChecklistCommand();
  async function salvar() {
    const input = {
      identidadeId: modelo?.id,
      expectedRevision: modelo?.revision ?? 0,
      escopo,
      codigo,
      nome,
      descricao: descricao || null,
      secao,
      obrigatorio,
      ordem,
      ativo,
    };
    const data = await command.run(JSON.stringify(input), (mutationId) => publicarModeloChecklist({ ...input, mutationId }));
    if (data) onSaved();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{modelo ? "Publicar nova revisão" : "Novo documento do modelo"}</DialogTitle>
          <DialogDescription>A revisão altera somente novas instâncias. Código e escopo da identidade são imutáveis.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="space-y-3"
        >
          <label className="block text-xs">
            Escopo
            <select value={escopo} disabled={!!modelo} onChange={(e) => setEscopo(e.target.value)} className={campoChecklist}>
              <option value="GLOBAL">Global</option>
              {tiposChecklist.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {[
            { label: "Código", value: codigo, set: setCodigo, disabled: !!modelo },
            { label: "Nome", value: nome, set: setNome, disabled: false },
            { label: "Descrição", value: descricao, set: setDescricao, disabled: false },
          ].map((f) => (
            <label key={f.label} className="block text-xs">
              {f.label}
              <input
                required={f.label !== "Descrição"}
                disabled={f.disabled}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className={campoChecklist}
              />
            </label>
          ))}
          <label className="block text-xs">
            Seção
            <select value={secao} onChange={(e) => setSecao(e.target.value)} className={campoChecklist}>
              {Object.values(SECOES).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Ordem
            <input type="number" min={0} max={100000} required value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className={campoChecklist} />
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
            Obrigatório
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo para novos checklists
          </label>
          {command.error && <Falha error={command.error} />}
          <Acao disabled={command.busy} type="submit">
            {command.busy ? "Publicando…" : "Publicar revisão"}
          </Acao>
        </form>
      </DialogContent>
    </Dialog>
  );
}
