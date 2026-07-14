"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FilePlus2, Globe2, Loader2, Plus, Tag } from "lucide-react";
import { TipoEmbasamento } from "@prisma/client";
import { criarModeloEmbasamento, ModeloChecklistConfiguracao } from "@/actions/checklist-modelos";
import { EMBASAMENTO_LABELS, SECOES_MODELO, SECOES_MODELO_LABELS } from "@/lib/checklist/modelos";

interface ModeloEmbasamentoClientProps {
  tipo: TipoEmbasamento;
  modelos: ModeloChecklistConfiguracao[];
}

const VALOR_INICIAL_SECAO = SECOES_MODELO[0];
type SecaoModelo = (typeof SECOES_MODELO)[number];

export default function ModeloEmbasamentoClient({ tipo, modelos }: ModeloEmbasamentoClientProps) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [secao, setSecao] = useState<SecaoModelo>(VALOR_INICIAL_SECAO);
  const [obrigatorio, setObrigatorio] = useState(true);
  const [escopo, setEscopo] = useState<"ESPECIFICO" | "GLOBAL">("ESPECIFICO");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    const resposta = await criarModeloEmbasamento({
      tipoAtual: tipo,
      codigo,
      nome,
      descricao: descricao || null,
      secao,
      obrigatorio,
      escopo,
    });
    setSalvando(false);
    if (resposta.error) {
      setErro(resposta.error);
      return;
    }
    setCodigo("");
    setNome("");
    setDescricao("");
    setSecao(VALOR_INICIAL_SECAO);
    setObrigatorio(true);
    setEscopo("ESPECIFICO");
    router.refresh();
  };

  return (
    <main className="min-h-screen px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <Link href="/PainelAlpha/CheckList/Embasamentos" className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-white"><ArrowLeft size={15} /> Todos os embasamentos</Link>
      <header className="mb-8 max-w-3xl">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">Modelo de embasamento</p>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white md:text-4xl">{EMBASAMENTO_LABELS[tipo]}</h1>
        <p className="mt-3 text-sm text-slate-400">Os documentos globais aparecem em todos os modelos. Os específicos entram somente neste embasamento.</p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {modelos.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/40 p-8 text-sm text-slate-500">Ainda não há documentos configurados para este embasamento.</div>
        ) : modelos.map((modelo) => (
          <article key={modelo.id} className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-black tracking-widest text-blue-200">{modelo.codigo}</span>
              <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest " + (modelo.tipo === null ? "bg-violet-500/15 text-violet-200" : "bg-blue-500/15 text-blue-200")}>
                {modelo.tipo === null ? <Globe2 size={11} /> : <Tag size={11} />}{modelo.tipo === null ? "Global" : "Específico"}
              </span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-wide text-white">{modelo.nome}</h2>
            {modelo.descricao && <p className="mt-2 text-xs leading-relaxed text-slate-400">{modelo.descricao}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-slate-400">{SECOES_MODELO_LABELS[modelo.secao as keyof typeof SECOES_MODELO_LABELS] ?? modelo.secao}</span>
              <span className={"rounded-full px-2.5 py-1 " + (modelo.obrigatorio ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400")}>{modelo.obrigatorio ? "Obrigatório" : "Opcional"}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-blue-400/20 bg-blue-500/[0.04] p-5 md:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="rounded-2xl bg-blue-500/15 p-3 text-blue-200"><FilePlus2 size={21} /></span><div><h2 className="text-base font-black uppercase tracking-wide text-white">Adicionar documento</h2><p className="mt-1 text-xs text-slate-400">Configure o próximo card deste modelo.</p></div></div>
        <form onSubmit={salvar} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Campo label="Código do documento" value={codigo} onChange={setCodigo} placeholder="Ex.: CAP_FIN_001" />
          <Campo label="Nome do documento" value={nome} onChange={setNome} placeholder="Ex.: Balancete mensal" />
          <label className="md:col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">Descrição complementar</span><textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Instruções ou observações para este documento" className="min-h-24 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50" /></label>
          <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">Seção</span><select value={secao} onChange={(event) => { const proximaSecao = SECOES_MODELO.find((opcao) => opcao === event.target.value); if (proximaSecao) setSecao(proximaSecao); }} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50">{SECOES_MODELO.map((opcao) => <option key={opcao} value={opcao}>{SECOES_MODELO_LABELS[opcao]}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">Escopo</span><select value={escopo} onChange={(event) => setEscopo(event.target.value as "ESPECIFICO" | "GLOBAL")} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50"><option value="ESPECIFICO">Apenas este embasamento</option><option value="GLOBAL">Global para todos</option></select></label>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 md:col-span-2"><input type="checkbox" checked={obrigatorio} onChange={(event) => setObrigatorio(event.target.checked)} className="size-4 accent-blue-500" /><span>Documento obrigatório</span></label>
          {erro && <p className="text-xs text-rose-300 md:col-span-2">{erro}</p>}
          <div className="md:col-span-2"><button disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">{salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{salvando ? "Salvando" : "Criar documento"}</button></div>
        </form>
      </section>
    </main>
  );
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (valor: string) => void; placeholder: string }) {
  return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><input required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50" /></label>;
}
