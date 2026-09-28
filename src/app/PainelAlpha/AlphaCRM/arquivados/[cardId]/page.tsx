import Link from "next/link";
import { ArrowLeft, Paperclip } from "lucide-react";
import { ObterCardArquivadoBpm } from "@/actions/bpm/Arquivados";
import { fmtDateTime } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function CardArquivadoPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const resultado = await ObterCardArquivadoBpm(cardId);
  const card = resultado.success ? resultado.data : null;
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-8">
    <Link href="/PainelAlpha/AlphaCRM/arquivados" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} />Cards arquivados</Link>
    {!card ? <p role="alert" className="rounded-xl border border-rose-500/30 p-5 text-rose-200">{resultado.error}</p> : <>
      <header><span className="rounded-full border border-slate-500/50 px-3 py-1 text-xs text-slate-300">Arquivado · somente leitura</span><h1 className="mt-3 text-2xl font-bold text-white">{card.empresa.razaoSocial || card.empresa.nomeFantasia || "Empresa sem nome"}</h1><p className="mt-1 text-slate-300">{card.localizacao.pipelineNome} · {card.localizacao.etapaNome}</p><p className="mt-1 text-xs text-slate-400">Arquivado em {fmtDateTime(card.arquivadoEm)}</p></header>
      <section aria-label="Dados do card" className="grid gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-5 sm:grid-cols-2">
        {[
          ["CNPJ", card.empresa.cnpj], ["Nome fantasia", card.empresa.nomeFantasia],
          ["Responsável", card.responsavel.nome], ["Serviço", card.servico],
          ["Tipo de processo", card.tipoProcesso], ["Criado em", fmtDateTime(card.createdAt)],
          ["Próximo contato", card.proximoContatoEm && fmtDateTime(card.proximoContatoEm)],
          ["Reunião", card.dataReuniao && fmtDateTime(card.dataReuniao)],
          ["Status após fechamento", card.statusPosFechamento],
        ].map(([rotulo, valor]) => <div key={rotulo} className="min-w-0"><dt className="text-xs text-slate-400">{rotulo}</dt><dd className="break-words text-sm text-white">{valor || "—"}</dd></div>)}
      </section>
      {card.transcricaoReuniao && <section className="rounded-xl border border-white/10 bg-slate-900/70 p-5"><h2 className="font-semibold text-white">Transcrição da reunião</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{card.transcricaoReuniao}</p></section>}
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-5"><h2 className="font-semibold text-white">Campos do card</h2>{card.campos.length ? <dl className="mt-3 grid gap-3 sm:grid-cols-2">{card.campos.map((campo) => {
        const anexoCampo = ["arquivo", "url_ou_arquivo"].includes(campo.tipo)
          ? card.anexos.find((anexo) => anexo.id === campo.valor) : null;
        return <div key={campo.nome}><dt className="text-xs text-slate-400">{campo.nome}</dt><dd className="whitespace-pre-wrap break-words text-sm text-white">{anexoCampo
          ? <a href={anexoCampo.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">{anexoCampo.nome}</a>
          : campo.tipo === "arquivo" && campo.valor ? "Arquivo não disponível" : campo.valor || "—"}</dd></div>;
      })}</dl> : <p className="mt-2 text-sm text-slate-400">Nenhum campo configurado para consulta.</p>}</section>
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-5"><h2 className="font-semibold text-white">Anexos</h2>{card.anexos.length ? <ul className="mt-3 space-y-2">{card.anexos.map((anexo) => <li key={anexo.id}><a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 break-all text-sm text-cyan-300 hover:underline"><Paperclip size={14} />{anexo.nome}</a> <span className="text-xs text-slate-400">{fmtDateTime(anexo.createdAt)}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Nenhum anexo.</p>}</section>
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-5"><h2 className="font-semibold text-white">Histórico recente</h2>{card.historico.length ? <ol className="mt-3 space-y-2">{card.historico.map((evento, index) => <li key={`${evento.createdAt.toISOString()}-${index}`} className="border-b border-white/5 pb-2 text-sm text-slate-300"><span className="font-medium text-white">{evento.acao.replaceAll("_", " ")}</span> · {evento.usuario?.nome ?? "Sistema"} · {fmtDateTime(evento.createdAt)}</li>)}</ol> : <p className="mt-2 text-sm text-slate-400">Nenhum evento registrado.</p>}</section>
    </>}
  </main>;
}
