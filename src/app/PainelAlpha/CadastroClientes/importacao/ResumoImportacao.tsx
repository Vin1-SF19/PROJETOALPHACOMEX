"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LinhaImportacaoPreview, StatusLinhaImportacao, TipoImportacao } from "@/lib/cs-nps/importacao-tipos";
import { calcularTotais, obterClienteIdLinha, obterStatusLinha, type SelecoesDestino } from "./calculos";
import { LinhaImportacaoCard } from "./LinhaImportacaoCard";

interface ResumoImportacaoProps {
  nomeArquivo: string;
  linhas: LinhaImportacaoPreview[];
  selecoes: SelecoesDestino;
  onSelecionarDestino: (linhaId: string, clienteId: number) => void;
  onRemover: (linhaId: string) => void;
}

type FiltroStatus = StatusLinhaImportacao | "todos";
type FiltroTipo = TipoImportacao | "todos";

interface GrupoLinhas {
  chave: string;
  titulo: string;
  detalhe: string;
  linhas: LinhaImportacaoPreview[];
}

function agruparLinhas(linhas: LinhaImportacaoPreview[], selecoes: SelecoesDestino): GrupoLinhas[] {
  const grupos = new Map<string, GrupoLinhas>();
  for (const linha of linhas) {
    const clienteId = obterClienteIdLinha(linha, selecoes);
    const candidato = linha.candidatos.find((item) => item.clienteId === clienteId);
    const chave = candidato ? `cliente-${candidato.clienteId}` : `pendente-${linha.identificador.cnpj || linha.identificador.razaoSocial || linha.id}`;
    const grupo = grupos.get(chave) ?? {
      chave,
      titulo: candidato?.razaoSocial || linha.identificador.razaoSocial || "Empresa sem correspondência",
      detalhe: candidato
        ? `${candidato.cnpj} · ${candidato.servico || "Sem serviço"} · ${candidato.status}`
        : linha.identificador.cnpj || "Destino pendente",
      linhas: [],
    };
    grupo.linhas.push(linha);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

export function ResumoImportacao({
  nomeArquivo,
  linhas,
  selecoes,
  onSelecionarDestino,
  onRemover,
}: ResumoImportacaoProps) {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const totais = useMemo(() => calcularTotais(linhas, selecoes), [linhas, selecoes]);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const filtradas = linhas.filter((linha) => {
      const status = obterStatusLinha(linha, selecoes);
      const candidato = linha.candidatos.find((item) => item.clienteId === obterClienteIdLinha(linha, selecoes));
      const texto = [linha.identificador.cnpj, linha.identificador.razaoSocial, candidato?.razaoSocial, candidato?.servico]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return (filtroStatus === "todos" || status === filtroStatus)
        && (filtroTipo === "todos" || linha.tipo === filtroTipo)
        && (!termo || texto.includes(termo));
    });
    return agruparLinhas(filtradas, selecoes);
  }, [busca, filtroStatus, filtroTipo, linhas, selecoes]);

  return (
    <section className="space-y-5" aria-labelledby="titulo-revisao-importacao">
      <div>
        <h3 id="titulo-revisao-importacao" className="text-lg font-black text-slate-100">Revise antes de salvar</h3>
        <p className="mt-1 text-sm text-slate-400">
          {nomeArquivo} foi analisado sem alterar o banco. Resolva destinos pendentes ou remova qualquer linha indesejada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <IndicadorResumo icone={FileSpreadsheet} rotulo="Total" valor={totais.total} classe="text-slate-200" />
        <IndicadorResumo icone={CheckCircle2} rotulo="Prontas" valor={totais.validas} classe="text-emerald-300" />
        <IndicadorResumo icone={AlertTriangle} rotulo="Ambíguas" valor={totais.ambiguas} classe="text-amber-300" />
        <IndicadorResumo icone={AlertTriangle} rotulo="Inválidas" valor={totais.invalidas} classe="text-rose-300" />
        <IndicadorResumo icone={Users} rotulo="Empresas" valor={agruparLinhas(linhas, selecoes).length} classe="text-indigo-300" />
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Filtrar empresa, CNPJ ou serviço..."
            aria-label="Filtrar linhas por empresa, CNPJ ou serviço"
            className="border-white/10 bg-slate-950/50 pl-9 text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <Select value={filtroTipo} onValueChange={(valor: FiltroTipo) => setFiltroTipo(valor)}>
          <SelectTrigger className="w-full border-white/10 bg-slate-950/50 text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-950 text-slate-100">
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="socios">Sócios ({totais.porTipo.socios})</SelectItem>
            <SelectItem value="cs">CS ({totais.porTipo.cs})</SelectItem>
            <SelectItem value="feedbacks">Feedbacks ({totais.porTipo.feedbacks})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(valor: FiltroStatus) => setFiltroStatus(valor)}>
          <SelectTrigger className="w-full border-white/10 bg-slate-950/50 text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-950 text-slate-100">
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="valida">Prontas</SelectItem>
            <SelectItem value="ambigua">Ambíguas</SelectItem>
            <SelectItem value="invalida">Inválidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1 custom-scrollbar">
        {grupos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
            Nenhuma linha corresponde aos filtros atuais.
          </div>
        ) : grupos.map((grupo) => (
          <section key={grupo.chave} className="space-y-2" aria-label={`Importações para ${grupo.titulo}`}>
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-xl">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black text-slate-100">{grupo.titulo}</h4>
                <p className="truncate text-[11px] text-slate-500">{grupo.detalhe}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-indigo-300">{grupo.linhas.length} {grupo.linhas.length === 1 ? "linha" : "linhas"}</span>
            </header>
            {grupo.linhas.map((linha) => (
              <LinhaImportacaoCard
                key={linha.id}
                linha={linha}
                status={obterStatusLinha(linha, selecoes)}
                clienteId={obterClienteIdLinha(linha, selecoes)}
                onSelecionarDestino={(clienteId) => onSelecionarDestino(linha.id, clienteId)}
                onRemover={() => onRemover(linha.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

interface IndicadorResumoProps {
  icone: typeof FileSpreadsheet;
  rotulo: string;
  valor: number;
  classe: string;
}

function IndicadorResumo({ icone: Icone, rotulo, valor, classe }: IndicadorResumoProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
      <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${classe}`}><Icone className="size-4" />{rotulo}</div>
      <p className="mt-2 text-2xl font-black text-slate-100">{valor}</p>
    </div>
  );
}
