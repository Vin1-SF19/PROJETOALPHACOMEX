"use client";

import { AlertTriangle, Building2, CheckCircle2, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  DadosLogImportacao,
  DadosSocioImportacao,
  LinhaImportacaoPreview,
  StatusLinhaImportacao,
} from "@/lib/cs-nps/importacao-tipos";
import { cn } from "@/lib/utils";
import { ROTULOS_SENTIMENTO, ROTULOS_TIPO } from "./constantes";

interface LinhaImportacaoCardProps {
  linha: LinhaImportacaoPreview;
  status: StatusLinhaImportacao;
  clienteId: number | null;
  onSelecionarDestino: (clienteId: number) => void;
  onRemover: () => void;
}

function detalhesSocio(dados: DadosSocioImportacao) {
  return [
    ["Nome", dados.nome],
    ["Telefone", dados.telefone],
    ["Nascimento", dados.dataNascimento],
    ["Vínculo", dados.vinculo],
    ["Observação", dados.observacao],
  ];
}

function detalhesLog(dados: DadosLogImportacao) {
  return [
    ["Colaborador", dados.colaborador],
    ["Sentimento", ROTULOS_SENTIMENTO[dados.sentimento]],
    ["Data", dados.dataRegistro],
    ["Observação", dados.observacao],
  ];
}

function rotuloCandidato(linha: LinhaImportacaoPreview, clienteId: number): string {
  const candidato = linha.candidatos.find((item) => item.clienteId === clienteId);
  if (!candidato) return "Destino selecionado";
  return `${candidato.razaoSocial} • ${candidato.servico || "Sem serviço"}`;
}

export function LinhaImportacaoCard({
  linha,
  status,
  clienteId,
  onSelecionarDestino,
  onRemover,
}: LinhaImportacaoCardProps) {
  const dados = "nome" in linha.dados
    ? detalhesSocio(linha.dados)
    : detalhesLog(linha.dados);
  const candidato = linha.candidatos.find((item) => item.clienteId === clienteId);

  return (
    <article className={cn(
      "rounded-2xl border p-4",
      status === "valida" && "border-emerald-400/20 bg-emerald-500/[0.03]",
      status === "ambigua" && "border-amber-400/30 bg-amber-500/[0.04]",
      status === "invalida" && "border-rose-400/30 bg-rose-500/[0.04]",
    )}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-indigo-500/15 text-indigo-300">{ROTULOS_TIPO[linha.tipo]}</Badge>
          <Badge variant="outline" className="border-white/10 text-slate-400">{linha.aba} · linha {linha.numeroLinha}</Badge>
          <Badge className={cn(
            status === "valida" && "bg-emerald-500/15 text-emerald-300",
            status === "ambigua" && "bg-amber-500/15 text-amber-300",
            status === "invalida" && "bg-rose-500/15 text-rose-300",
          )}>
            {status === "valida" && <CheckCircle2 />}
            {status !== "valida" && <AlertTriangle />}
            {status === "valida" ? "Pronta" : status === "ambigua" ? "Escolha o destino" : "Inválida"}
          </Badge>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemover} className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200">
          <Trash2 /> Remover linha
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="rounded-xl border border-white/5 bg-slate-950/35 p-3">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            {linha.tipo === "socios" ? <UserRound className="size-4" /> : <Building2 className="size-4" />}
            Dados que serão criados
          </p>
          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {dados.filter(([, valor]) => valor).map(([rotulo, valor]) => (
              <div key={rotulo} className={rotulo === "Observação" ? "sm:col-span-2" : undefined}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{rotulo}</dt>
                <dd className="mt-0.5 break-words text-xs text-slate-200">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-950/35 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Empresa identificada</p>
          <p className="mt-1 text-sm font-bold text-slate-100">{linha.identificador.razaoSocial || "Por CNPJ"}</p>
          <p className="text-xs font-mono text-slate-400">{linha.identificador.cnpj || "CNPJ não informado"}</p>

          {linha.status !== "invalida" && linha.candidatos.length > 1 ? (
            <div className="mt-3">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-amber-300">
                Escolha empresa / serviço de destino
              </label>
              <Select value={clienteId?.toString()} onValueChange={(valor) => onSelecionarDestino(Number(valor))}>
                <SelectTrigger className="w-full border-amber-400/30 bg-slate-950/60 text-left text-slate-200">
                  <SelectValue placeholder="Selecione o cadastro correto">{clienteId ? rotuloCandidato(linha, clienteId) : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-950 text-slate-100">
                  {linha.candidatos.map((item) => (
                    <SelectItem key={item.clienteId} value={item.clienteId.toString()}>
                      {item.razaoSocial} · {item.servico || "Sem serviço"} · {item.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : candidato ? (
            <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-500/5 px-3 py-2">
              <p className="text-xs font-bold text-emerald-200">{candidato.razaoSocial}</p>
              <p className="text-[11px] text-slate-400">{candidato.servico || "Sem serviço"} · {candidato.status}</p>
            </div>
          ) : null}
        </div>
      </div>

      {linha.mensagens.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-200/90" aria-label="Mensagens de validação">
          {linha.mensagens.map((mensagem, indice) => <li key={`${linha.id}-mensagem-${indice}`}>• {mensagem}</li>)}
        </ul>
      )}
    </article>
  );
}
