"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Code2,
  FileCode2,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTOMACOES_EXECUTAVEIS_AUDITADAS,
  CATALOGO_AUDITORIA_AUTOMACOES,
  INTEGRACOES_MANUAIS_AUDITADAS,
  type ItemAuditoriaAutomacao,
  type StatusAuditoriaAutomacao,
} from "@/lib/bpm/automacoes/catalogo-modulos";

const STATUS_LABEL: Record<StatusAuditoriaAutomacao, string> = {
  EXECUTAVEL_MOTOR: "Executável no Motor Central",
  INTEGRACAO_MANUAL: "Integração existente · acionamento manual",
};

function ItemAuditoria({ item }: { item: ItemAuditoriaAutomacao }) {
  const executavel = item.status === "EXECUTAVEL_MOTOR";
  return (
    <details className="group rounded-xl border border-white/[0.07] bg-slate-950/65 open:border-cyan-400/20">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 marker:content-none">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {executavel
              ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              : <CircleAlert size={15} className="shrink-0 text-amber-400" />}
            <h3 className="text-sm font-bold text-white">{item.nome}</h3>
            <Badge variant="outline" className={executavel
              ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
              : "border-amber-400/20 bg-amber-400/5 text-amber-200"}
            >{STATUS_LABEL[item.status]}</Badge>
          </div>
          <p className="mt-1 text-xs font-semibold text-cyan-300">{item.modulo}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{item.descricao}</p>
        </div>
        <ChevronDown size={16} className="mt-1 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-white/[0.06] px-4 py-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300"><Workflow size={13} /> Caminho executado</p>
          <ol className="space-y-1.5 text-xs text-slate-400">
            {item.fluxo.map((passo, indice) => <li key={passo} className="flex gap-2"><span className="font-mono text-cyan-400">{indice + 1}.</span>{passo}</li>)}
          </ol>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-300">Pré-requisitos</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {item.preRequisitos.map((requisito) => <li key={requisito}>• {requisito}</li>)}
          </ul>
          <p className="mt-3 text-xs text-slate-300"><span className="font-semibold text-white">Resultado:</span> {item.resultado}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 lg:col-span-2">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300"><FileCode2 size={13} /> Evidência no código</p>
          {item.acaoTipo && <p className="mb-2 font-mono text-[11px] text-emerald-300">ação canônica: {item.acaoTipo}</p>}
          <div className="flex flex-wrap gap-2">
            {item.evidencias.map((arquivo) => <code key={arquivo} className="rounded-md bg-slate-900 px-2 py-1 text-[10px] text-slate-400">{arquivo}</code>)}
          </div>
        </div>
      </div>
    </details>
  );
}

export function AuditoriaAutomacoesCodigo({ accent }: { accent: string }) {
  const [catalogoCompleto, setCatalogoCompleto] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"TODOS" | StatusAuditoriaAutomacao>("TODOS");

  const itens = useMemo(() => {
    const base = catalogoCompleto
      ? CATALOGO_AUDITORIA_AUTOMACOES
      : CATALOGO_AUDITORIA_AUTOMACOES.filter((item) => item.destaque);
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return base.filter((item) => (
      (status === "TODOS" || item.status === status)
      && (!termo || [item.nome, item.modulo, item.descricao, item.acaoTipo, ...item.evidencias]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase("pt-BR").includes(termo)))
    ));
  }, [busca, catalogoCompleto, status]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-slate-950/70 shadow-xl" aria-labelledby="auditoria-automacoes-titulo">
      <div className="border-b border-white/[0.07] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl" style={{ background: `rgba(${accent},0.14)`, color: `rgb(${accent})` }}><ShieldCheck size={18} /></span>
              <div>
                <h2 id="auditoria-automacoes-titulo" className="font-black text-white">Auditoria das automações do código</h2>
                <p className="mt-0.5 text-xs text-slate-400">Catálogo ligado aos tipos aceitos pelo Motor Central, com o caminho e os arquivos que sustentam cada integração.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">{AUTOMACOES_EXECUTAVEIS_AUDITADAS.length} executáveis no Motor</Badge>
              <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">{INTEGRACOES_MANUAIS_AUDITADAS.length} integração manual identificada</Badge>
              <Badge variant="outline" className="border-white/10 text-slate-400"><Code2 size={12} /> Verificação protegida por teste</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => setCatalogoCompleto((atual) => !atual)}>
            {catalogoCompleto ? "Mostrar somente destaques" : `Ver catálogo completo (${CATALOGO_AUDITORIA_AUTOMACOES.length})`}
          </Button>
        </div>
      </div>

      {catalogoCompleto && (
        <div className="grid gap-3 border-b border-white/[0.06] bg-white/[0.015] p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar módulo, ação ou arquivo do código" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["TODOS", "EXECUTAVEL_MOTOR", "INTEGRACAO_MANUAL"] as const).map((opcao) => (
              <Button key={opcao} type="button" size="sm" variant={status === opcao ? "secondary" : "ghost"} onClick={() => setStatus(opcao)}>
                {opcao === "TODOS" ? "Todos" : opcao === "EXECUTAVEL_MOTOR" ? "Motor Central" : "Manuais"}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {itens.map((item) => <ItemAuditoria key={item.id} item={item} />)}
        {itens.length === 0 && <p className="py-8 text-center text-sm text-slate-500 xl:col-span-2">Nenhuma integração corresponde ao filtro.</p>}
      </div>
      <p className="border-t border-white/[0.06] px-5 py-3 text-[11px] leading-5 text-slate-500">
        “Executável no Motor Central” significa que há contrato validado e executor no worker. “Integração manual” confirma código e persistência existentes, mas não autoriza apresentá-la como ação automática.
      </p>
    </section>
  );
}
