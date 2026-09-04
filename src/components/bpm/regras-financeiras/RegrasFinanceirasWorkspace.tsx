"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Power } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AlternarRegraTributaria, SalvarRegraTributaria } from "@/actions/bpm/RegrasFinanceiras";
import { ConstrutorRegras } from "@/components/Comissoes/Configuracoes/ConstrutorRegras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMULA_LIQUIDO_PADRAO } from "@/lib/bpm/regras-financeiras/schemas";

interface PipelineView { id: string; nome: string; campos: Array<{ id: string; nome: string; tipo: string; opcoesJson: string | null }> }
interface RegraView { id: string; nome: string; descricao: string | null; ativa: boolean; prioridade: number; pipelineId: string; versao: number; condicao: unknown; configuracao: { irrf: { aplicavel: boolean; aliquotaPercentual: number; baseCalculo: "VALOR_BRUTO" | "VALOR_BRUTO_MENOS_RETENCOES" }; csrf: { aplicavel: boolean; aliquotaPercentual: number; baseCalculo: "VALOR_BRUTO" | "VALOR_BRUTO_MENOS_RETENCOES" }; outrasRetencoes: Array<{ nome: string; tipo: "PERCENTUAL" | "FIXO"; baseCalculo: "VALOR_BRUTO" | "VALOR_BRUTO_MENOS_RETENCOES"; aliquotaPercentual?: number; valorFixoCents?: number }>; formulaValorLiquido: string } }

export function RegrasFinanceirasWorkspace({ pipelines, regras, colaboradores, erro }: { pipelines: PipelineView[]; regras: RegraView[]; colaboradores: Array<{ id: number; nome: string; cargo: string | null }>; erro: string | null; accent: string }) {
  const router = useRouter();
  const [aba, setAba] = useState<"tributos" | "comissoes">("tributos");
  const [isPending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [prioridade, setPrioridade] = useState("0");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [campoId, setCampoId] = useState("");
  const [valorCondicao, setValorCondicao] = useState("");
  const [irrf, setIrrf] = useState("0");
  const [csrf, setCsrf] = useState("0");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [baseIrrf, setBaseIrrf] = useState<"VALOR_BRUTO" | "VALOR_BRUTO_MENOS_RETENCOES">("VALOR_BRUTO");
  const [baseCsrf, setBaseCsrf] = useState<"VALOR_BRUTO" | "VALOR_BRUTO_MENOS_RETENCOES">("VALOR_BRUTO");
  const [formula, setFormula] = useState(FORMULA_LIQUIDO_PADRAO);

  const pipeline = pipelines.find((item) => item.id === pipelineId);
  function salvar() {
    if (!nome.trim() || !pipelineId) return toast.error("Informe nome e pipeline.");
    startTransition(async () => {
      const condicao = campoId && valorCondicao
        ? { operador: "AND" as const, condicoes: [{ tipo: "condicao" as const, campo: { fonte: "campo_dinamico" as const, campo: campoId }, operador: "igual" as const, valor: valorCondicao, tipoEsperado: "texto" as const }] }
        : { operador: "AND" as const, condicoes: [{ tipo: "condicao" as const, campo: { fonte: "card" as const, campo: "id" as const }, operador: "preenchido" as const }] };
      const resultado = await SalvarRegraTributaria({
        id: editandoId ?? undefined, nome: nome.trim(), ativa: true, prioridade: Number(prioridade), pipelineId, condicao,
        configuracao: {
          schemaVersion: 1,
          irrf: { aplicavel: Number(irrf.replace(",", ".")) > 0, aliquotaPercentual: Number(irrf.replace(",", ".")), baseCalculo: baseIrrf },
          csrf: { aplicavel: Number(csrf.replace(",", ".")) > 0, aliquotaPercentual: Number(csrf.replace(",", ".")), baseCalculo: baseCsrf },
          outrasRetencoes: [], formulaValorLiquido: formula,
        },
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Regra tributária versionada.");
      setNome(""); setEditandoId(null); router.refresh();
    });
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <div><Link href="/PainelAlpha/AlphaCRM/admin" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ArrowLeft className="size-3.5" />Configurações</Link><h1 className="mt-2 text-xl font-black text-white">Regras Financeiras</h1><p className="text-sm text-slate-400">Tributos, fórmulas e comissões sem alíquotas hardcoded.</p></div>
    <div className="flex gap-2"><Button variant={aba === "tributos" ? "default" : "outline"} onClick={() => setAba("tributos")}>Tributárias</Button><Button variant={aba === "comissoes" ? "default" : "outline"} onClick={() => setAba("comissoes")}>Comissões</Button></div>
    {erro && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{erro}</p>}
    {aba === "comissoes" ? <ConstrutorRegras colaboradores={colaboradores} /> : <>
      <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold text-white"><Plus className="mr-1 inline size-4" />Nova linha da tabela de decisão</h2>
        <div className="grid gap-3 md:grid-cols-3"><div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div><div><Label>Pipeline</Label><Select value={pipelineId} onValueChange={(value) => { setPipelineId(value); setCampoId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{pipelines.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div><Label>Prioridade (menor vence)</Label><Input type="number" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} /></div></div>
        <div className="grid gap-3 md:grid-cols-4"><div><Label>Campo da condição (opcional)</Label><Select value={campoId || "todos"} onValueChange={(value) => setCampoId(value === "todos" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os cards</SelectItem>{pipeline?.campos.map((campo) => <SelectItem key={campo.id} value={campo.id}>{campo.nome}</SelectItem>)}</SelectContent></Select></div><div><Label>Valor esperado</Label><Input value={valorCondicao} disabled={!campoId} onChange={(e) => setValorCondicao(e.target.value)} /></div><div><Label>IRRF (%)</Label><Input inputMode="decimal" value={irrf} onChange={(e) => setIrrf(e.target.value)} /><Select value={baseIrrf} onValueChange={(v) => setBaseIrrf(v as typeof baseIrrf)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VALOR_BRUTO">Base bruta</SelectItem><SelectItem value="VALOR_BRUTO_MENOS_RETENCOES">Após retenções</SelectItem></SelectContent></Select></div><div><Label>CSRF (%)</Label><Input inputMode="decimal" value={csrf} onChange={(e) => setCsrf(e.target.value)} /><Select value={baseCsrf} onValueChange={(v) => setBaseCsrf(v as typeof baseCsrf)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VALOR_BRUTO">Base bruta</SelectItem><SelectItem value="VALOR_BRUTO_MENOS_RETENCOES">Após retenções</SelectItem></SelectContent></Select></div></div>
        <div><Label>Fórmula do valor líquido</Label><Input value={formula} onChange={(e) => setFormula(e.target.value)} /><p className="mt-1 text-[11px] text-slate-500">Variáveis: valorBruto, valorIrrf, valorCsrf, outrasRetencoes e totalRetencoes.</p></div>
        <Button onClick={salvar} disabled={isPending}>{isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{editandoId ? "Salvar nova versão" : "Salvar regra"}</Button>
      </section>
      <section className="space-y-2"><h2 className="text-sm font-bold text-white">Tabela publicada</h2>{regras.map((regra) => <div key={regra.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/50 p-3"><div><p className="text-sm font-semibold text-white">{regra.nome}</p><p className="text-xs text-slate-400">prioridade {regra.prioridade} · versão {regra.versao} · IRRF {regra.configuracao.irrf.aliquotaPercentual}% · CSRF {regra.configuracao.csrf.aliquotaPercentual}%</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={isPending} onClick={() => { setEditandoId(regra.id); setNome(regra.nome); setPrioridade(String(regra.prioridade)); setPipelineId(regra.pipelineId); setIrrf(String(regra.configuracao.irrf.aliquotaPercentual)); setCsrf(String(regra.configuracao.csrf.aliquotaPercentual)); setBaseIrrf(regra.configuracao.irrf.baseCalculo); setBaseCsrf(regra.configuracao.csrf.baseCalculo); setFormula(regra.configuracao.formulaValorLiquido); setCampoId(""); setValorCondicao(""); }}><Pencil className="mr-1 size-3.5" />Editar</Button><Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(async () => { const result = await AlternarRegraTributaria({ id: regra.id, ativa: !regra.ativa }); if (!result.success) toast.error(result.error); else router.refresh(); })}><Power className="mr-1 size-3.5" />{regra.ativa ? "Inativar" : "Ativar"}</Button></div></div>)}{regras.length === 0 && <p className="text-sm text-slate-500">Nenhuma regra tributária cadastrada.</p>}</section>
    </>}
  </main>;
}
