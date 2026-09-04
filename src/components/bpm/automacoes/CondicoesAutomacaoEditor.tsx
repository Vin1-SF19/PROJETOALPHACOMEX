"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMPOS_FIXOS_POR_FONTE,
  OPERADORES_REGRAS,
  type CampoReferencia,
  type FonteCampo,
  type GrupoCondicao,
  type OperadorRegra,
} from "@/lib/bpm/regras/types";

type Catalogos = {
  campos: { id: string; nome: string }[];
  servicos: { id: number; nome: string }[];
  parceiros: { id: number; nome: string; nomeFantasia: string | null }[];
};

type Linha = {
  fonte: FonteCampo;
  campo: string;
  operador: OperadorRegra;
  valor: string;
};

const FONTES: FonteCampo[] = ["card", "cliente", "processo", "contratacao", "relacionada", "checklist", "campo_dinamico"];
const SEM_VALOR = new Set<OperadorRegra>(["preenchido", "vazio"]);
const LISTA = new Set<OperadorRegra>(["estaEm", "naoEstaEm"]);

const FONTE_LABEL: Record<FonteCampo, string> = {
  card: "Card",
  cliente: "Cliente",
  processo: "Processo",
  contratacao: "Contratação/origem",
  relacionada: "Relacionados",
  checklist: "Checklist",
  campo_dinamico: "Campo configurável",
};

function linhaInicial(): Linha {
  return { fonte: "card", campo: "id", operador: "preenchido", valor: "" };
}

function paraLinha(item: GrupoCondicao["condicoes"][number]): Linha | null {
  if (!("tipo" in item)) return null;
  return {
    fonte: item.campo.fonte,
    campo: item.campo.campo,
    operador: item.operador,
    valor: Array.isArray(item.valor) ? item.valor.join(", ") : item.valor == null ? "" : String(item.valor),
  };
}

function paraCondicao(linha: Linha) {
  const base = {
    tipo: "condicao" as const,
    campo: { fonte: linha.fonte, campo: linha.campo } as CampoReferencia,
    operador: linha.operador,
  };
  if (SEM_VALOR.has(linha.operador)) return base;
  if (LISTA.has(linha.operador)) return { ...base, valor: linha.valor.split(",").map((item) => item.trim()).filter(Boolean) };
  const numero = Number(linha.valor);
  return { ...base, valor: linha.valor.trim() !== "" && Number.isFinite(numero) ? numero : linha.valor };
}

export function CondicoesAutomacaoEditor(props: {
  value: GrupoCondicao;
  onChange: (value: GrupoCondicao) => void;
  catalogos: Catalogos;
}) {
  const linhas = props.value.condicoes.map(paraLinha).filter((item): item is Linha => Boolean(item));
  const efetivas = linhas.length > 0 ? linhas : [linhaInicial()];

  const emitir = (proximas: Linha[], operador = props.value.operador) => {
    props.onChange({ operador, condicoes: proximas.map(paraCondicao) });
  };

  const atualizar = (indice: number, patch: Partial<Linha>) => {
    emitir(efetivas.map((linha, atual) => atual === indice ? { ...linha, ...patch } : linha));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Condições (SE)</p>
        <Select value={props.value.operador} onValueChange={(value: "AND" | "OR") => emitir(efetivas, value)}>
          <SelectTrigger className="w-44" aria-label="Combinação das condições"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="AND">Todas (E)</SelectItem><SelectItem value="OR">Qualquer (OU)</SelectItem></SelectContent>
        </Select>
      </div>
      {efetivas.map((linha, indice) => {
        const campos = linha.fonte === "campo_dinamico"
          ? props.catalogos.campos.map((campo) => ({ value: campo.id, label: campo.nome }))
          : CAMPOS_FIXOS_POR_FONTE[linha.fonte].map((campo) => ({ value: campo, label: campo }));
        const seletorServico = linha.campo === "servico" && (linha.fonte === "card" || linha.fonte === "contratacao");
        const seletorParceiro = linha.fonte === "contratacao" && linha.campo === "indicadoPorParceiroId";
        return (
          <div key={`${indice}-${linha.fonte}`} className="grid gap-2 rounded-lg border border-white/[0.07] p-3 sm:grid-cols-[1fr_1.3fr_1fr_1.3fr_auto]">
            <Select value={linha.fonte} onValueChange={(fonte: FonteCampo) => {
              const primeiro = fonte === "campo_dinamico" ? props.catalogos.campos[0]?.id ?? "" : CAMPOS_FIXOS_POR_FONTE[fonte][0];
              atualizar(indice, { fonte, campo: primeiro });
            }}><SelectTrigger aria-label="Fonte"><SelectValue /></SelectTrigger><SelectContent>{FONTES.map((fonte) => <SelectItem key={fonte} value={fonte}>{FONTE_LABEL[fonte]}</SelectItem>)}</SelectContent></Select>
            <Select value={linha.campo} onValueChange={(campo) => atualizar(indice, { campo })}><SelectTrigger aria-label="Campo"><SelectValue placeholder="Campo" /></SelectTrigger><SelectContent>{campos.map((campo) => <SelectItem key={campo.value} value={campo.value}>{campo.label}</SelectItem>)}</SelectContent></Select>
            <Select value={linha.operador} onValueChange={(operador: OperadorRegra) => atualizar(indice, { operador })}><SelectTrigger aria-label="Operador"><SelectValue /></SelectTrigger><SelectContent>{OPERADORES_REGRAS.map((operador) => <SelectItem key={operador} value={operador}>{operador}</SelectItem>)}</SelectContent></Select>
            {SEM_VALOR.has(linha.operador) ? <span className="self-center text-xs text-slate-500">Sem valor</span> : seletorServico ? (
              <Select value={linha.valor} onValueChange={(valor) => atualizar(indice, { valor })}><SelectTrigger aria-label="Serviço"><SelectValue placeholder="Serviço" /></SelectTrigger><SelectContent>{props.catalogos.servicos.map((servico) => <SelectItem key={servico.id} value={servico.nome}>{servico.nome}</SelectItem>)}</SelectContent></Select>
            ) : seletorParceiro ? (
              <Select value={linha.valor} onValueChange={(valor) => atualizar(indice, { valor })}><SelectTrigger aria-label="Parceiro"><SelectValue placeholder="Parceiro" /></SelectTrigger><SelectContent>{props.catalogos.parceiros.map((parceiro) => <SelectItem key={parceiro.id} value={String(parceiro.id)}>{parceiro.nomeFantasia || parceiro.nome}</SelectItem>)}</SelectContent></Select>
            ) : <Input value={linha.valor} onChange={(event) => atualizar(indice, { valor: event.target.value })} placeholder={LISTA.has(linha.operador) ? "valor 1, valor 2" : "Valor"} aria-label="Valor da condição" />}
            <Button type="button" variant="ghost" size="icon" aria-label="Remover condição" disabled={efetivas.length === 1} onClick={() => emitir(efetivas.filter((_, atual) => atual !== indice))}><Trash2 size={15} /></Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => emitir([...efetivas, linhaInicial()])}><Plus size={14} /> Adicionar condição</Button>
    </div>
  );
}
