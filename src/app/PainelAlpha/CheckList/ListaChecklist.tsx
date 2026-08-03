"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, ChevronDown, ChevronUp, Edit3, Filter,
  FolderOpen, FolderPlus, History, Loader2, Plus, Save, Search, Settings2, X,
} from "lucide-react";
import {
  atualizarEmpresaChecklist, criarPastaChecklist, type DadosEmpresaChecklist,
  type EmpresaComProgresso, type PastaChecklistResumo,
} from "@/actions/checklist";
import Velocimetro from "@/components/Checklist/Velocimetro";
import ChecklistNotificacoesWidget from "@/components/Checklist/ChecklistNotificacoesWidget";
import { TIPO_LABELS } from "@/lib/checklist/items";
import { getTema } from "@/lib/temas";
import ModalCadastroCliente from "./Modais/CadastroCliente";
import { isAdminRole } from "@/lib/roles";

type TipoEmbasamento = NonNullable<EmpresaComProgresso["tipo"]>;

const TIPOS = Object.keys(TIPO_LABELS) as TipoEmbasamento[];
const STATUS_EMPRESA = ["ATIVO", "PENDENTE", "FINALIZADO"];

function texto(valor: string | null) {
  return valor ?? "";
}

function dadosDoCard(empresa: EmpresaComProgresso): DadosEmpresaChecklist {
  return {
    empresaId: empresa.id,
    razaoSocial: empresa.razaoSocial,
    nomeFantasia: empresa.nomeFantasia,
    cnpj: empresa.cnpj,
    status: empresa.status,
    embasamento: empresa.embasamento,
    tipo: empresa.tipo,
    pastaChecklistId: empresa.pastaChecklistId,
    mesProtocolo: empresa.mesProtocolo,
    linkGrupo: empresa.linkGrupo,
    situacaoRadar: empresa.situacaoRadar,
    submodalidade: empresa.submodalidade,
    dataSituacao: empresa.dataSituacao,
    municipio: empresa.municipio,
    uf: empresa.uf,
    regimeTributario: empresa.regimeTributario,
    capitalSocial: empresa.capitalSocial,
    dataConstituicao: empresa.dataConstituicao,
    contribuinte: empresa.contribuinte,
  };
}

export default function ListaChecklist({
  empresas,
  pastas: pastasIniciais,
  clientesAcesso = [],
  tema: temaNome = "blue",
  role = "",
}: {
  empresas: EmpresaComProgresso[];
  pastas: PastaChecklistResumo[];
  clientesAcesso?: { id: string; nome: string; email: string }[];
  tema?: string;
  role?: string;
}) {
  const tema = getTema(temaNome);
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TipoEmbasamento | "TODOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroPasta, setFiltroPasta] = useState("TODAS");
  const [filtroChecklist, setFiltroChecklist] = useState("TODOS");
  const [ordem, setOrdem] = useState("RECENTES");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pastas, setPastas] = useState(pastasIniciais);
  const [novaPasta, setNovaPasta] = useState("");
  const [criandoPasta, setCriandoPasta] = useState(false);

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = empresas.filter((empresa) => {
      const matchBusca = !termo ||
        empresa.razaoSocial.toLowerCase().includes(termo) ||
        empresa.nomeFantasia?.toLowerCase().includes(termo) ||
        empresa.cnpj.includes(termo);
      const matchTipo = filtroTipo === "TODOS" || empresa.tipo === filtroTipo;
      const matchStatus = filtroStatus === "TODOS" || empresa.status === filtroStatus;
      const matchPasta = filtroPasta === "TODAS" ||
        (filtroPasta === "SEM_PASTA" ? !empresa.pastaChecklistId : empresa.pastaChecklistId === filtroPasta);
      const matchChecklist = filtroChecklist === "TODOS" ||
        (filtroChecklist === "COM_CHECKLIST" ? empresa.temChecklist : !empresa.temChecklist);
      return matchBusca && matchTipo && matchStatus && matchPasta && matchChecklist;
    });

    return [...lista].sort((a, b) => {
      if (ordem === "NOME") return a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR");
      if (ordem === "PROGRESSO") return b.progressoReal - a.progressoReal;
      if (ordem === "PASTA") return (a.pastaChecklistNome ?? "ZZZ").localeCompare(b.pastaChecklistNome ?? "ZZZ", "pt-BR");
      return 0;
    });
  }, [busca, empresas, filtroChecklist, filtroPasta, filtroStatus, filtroTipo, ordem]);

  const criarPasta = async () => {
    if (!novaPasta.trim()) return;
    setCriandoPasta(true);
    const resposta = await criarPastaChecklist(novaPasta);
    setCriandoPasta(false);
    if (!resposta.data) return;
    setPastas((atual) => [...atual.filter((p) => p.id !== resposta.data?.id), resposta.data!]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    setNovaPasta("");
  };

  const concluidos = empresas.filter((empresa) => empresa.progressoReal === 100).length;
  const pastaSelecionada = pastas.find((pasta) => pasta.id === filtroPasta);

  return (
    <div className="min-h-screen px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "rgb(" + tema.accent + ")" }}>
            Módulo operacional
          </p>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-5xl">
            Checklist <span style={{ color: "rgb(" + tema.accent + ")" }}>RADAR</span>
          </h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            Gestão de documentação, embasamento e organização por empresa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Resumo titulo="Total" valor={empresas.length} />
          <Resumo titulo="Concluídos" valor={concluidos} sucesso />
          {(isAdminRole(role) || role === "OPERACIONAL") && <ChecklistNotificacoesWidget role={role} />}
        </div>
      </header>

      <section className="mb-5 rounded-[2rem] border border-white/5 bg-slate-950/50 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar empresa, nome fantasia ou CNPJ..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-blue-400/50"
            />
          </div>
          <button
            onClick={() => setFiltrosAbertos((aberto) => !aberto)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-blue-400/40 hover:text-white"
          >
            <Filter size={15} /> Filtros {filtrosAbertos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => setModoEdicao((ativo) => !ativo)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
          >
            {modoEdicao ? <X size={15} /> : <Edit3 size={15} />}
            {modoEdicao ? "Encerrar edição" : "Editar empresas"}
          </button>
          <Link
            href="/PainelAlpha/CheckList/Historico"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-300 transition hover:bg-rose-500/20"
          >
            <History size={15} /> Histórico
          </Link>
          <Link
            href="/PainelAlpha/CheckList/Embasamentos"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-violet-200 transition hover:bg-violet-500/20"
          >
            <Settings2 size={15} /> Configurar embasamentos
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
            style={{ background: "rgb(" + tema.accent + ")" }}
          >
            <Plus size={15} /> Nova empresa
          </button>
        </div>

        {filtrosAbertos && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/5 pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <FiltroSelect valor={filtroTipo} onChange={(valor) => setFiltroTipo(valor as TipoEmbasamento | "TODOS")} opcoes={[["TODOS", "Todos os embasamentos"], ...TIPOS.map((tipo) => [tipo, TIPO_LABELS[tipo]])]} />
            <FiltroSelect valor={filtroStatus} onChange={setFiltroStatus} opcoes={[["TODOS", "Todos os status"], ...STATUS_EMPRESA.map((status) => [status, status])]} />
            <FiltroSelect valor={filtroPasta} onChange={setFiltroPasta} opcoes={[["TODAS", "Todas as pastas"], ["SEM_PASTA", "Sem pasta"], ...pastas.map((pasta) => [pasta.id, pasta.nome])]} />
            <FiltroSelect valor={filtroChecklist} onChange={(valor) => setFiltroChecklist(valor as "TODOS" | "COM_CHECKLIST" | "SEM_CHECKLIST")} opcoes={[["TODOS", "Todo andamento"], ["COM_CHECKLIST", "Com checklist"], ["SEM_CHECKLIST", "Sem checklist"]]} />
            <FiltroSelect valor={ordem} onChange={(valor) => setOrdem(valor as "RECENTES" | "NOME" | "PROGRESSO" | "PASTA")} opcoes={[["RECENTES", "Mais recentes"], ["NOME", "Nome"], ["PROGRESSO", "Maior progresso"], ["PASTA", "Pasta"]]} />
          </div>
        )}
      </section>

      {pastas.length > 0 && (
        <section className="mb-5 rounded-[2rem] border border-white/5 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Visualizar por pasta</p>
              <p className="mt-1 text-xs text-slate-400">Selecione uma pasta para exibir somente as empresas dela.</p>
            </div>
            {pastaSelecionada && <button onClick={() => setFiltroPasta("TODAS")} className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-blue-200">Limpar visão</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            <PastaAtalho ativo={filtroPasta === "TODAS"} nome="Todas as empresas" quantidade={empresas.length} onClick={() => setFiltroPasta("TODAS")} />
            {pastas.map((pasta) => (
              <PastaAtalho
                key={pasta.id}
                ativo={filtroPasta === pasta.id}
                nome={pasta.nome}
                quantidade={empresas.filter((empresa) => empresa.pastaChecklistId === pasta.id).length}
                onClick={() => setFiltroPasta(pasta.id)}
              />
            ))}
            <PastaAtalho ativo={filtroPasta === "SEM_PASTA"} nome="Sem pasta" quantidade={empresas.filter((empresa) => !empresa.pastaChecklistId).length} onClick={() => setFiltroPasta("SEM_PASTA")} />
          </div>
        </section>
      )}

      {modoEdicao && (
        <section className="mb-5 flex flex-col gap-3 rounded-[2rem] border border-blue-400/20 bg-blue-500/5 p-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-blue-300">Modo de edição global ativo</p>
            <p className="mt-1 text-[11px] text-slate-400">Cada card agora permite alterar os dados da empresa, a pasta e o tipo do checklist.</p>
          </div>
          <div className="flex flex-1 gap-2">
            <input
              value={novaPasta}
              onChange={(event) => setNovaPasta(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void criarPasta(); }}
              placeholder="Nome da nova pasta"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2.5 text-xs text-white outline-none focus:border-blue-400/50"
            />
            <button
              onClick={() => void criarPasta()}
              disabled={criandoPasta || !novaPasta.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-200 disabled:opacity-50"
            >
              {criandoPasta ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
              Criar pasta
            </button>
          </div>
        </section>
      )}

      {pastaSelecionada && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] px-5 py-4">
          <FolderOpen size={18} className="text-blue-300" />
          <div><p className="text-xs font-black uppercase tracking-widest text-blue-100">Pasta: {pastaSelecionada.nome}</p><p className="mt-1 text-[11px] text-slate-400">{listaFiltrada.length} empresa(s) nesta visualização</p></div>
        </div>
      )}

      {listaFiltrada.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-[2rem] border border-white/5 bg-slate-950/40">
          <Building2 size={40} className="text-slate-700" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {listaFiltrada.map((empresa) => (
            <EmpresaCard key={empresa.id} empresa={empresa} pastas={pastas} editando={modoEdicao} />
          ))}
        </div>
      )}

      <ModalCadastroCliente
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientesExistentes={clientesAcesso}
      />
    </div>
  );
}

function Resumo({ titulo, valor, sucesso = false }: { titulo: string; valor: number; sucesso?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3">
      <p className={"text-[9px] font-black uppercase tracking-widest " + (sucesso ? "text-emerald-400" : "text-slate-500")}>{titulo}</p>
      <p className={"mt-0.5 text-3xl font-black leading-none " + (sucesso ? "text-emerald-300" : "text-white")}>{valor}</p>
    </div>
  );
}

function FiltroSelect({ valor, onChange, opcoes }: { valor: string; onChange: (valor: string) => void; opcoes: string[][] }) {
  return (
    <select
      value={valor}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-400/50"
    >
      {opcoes.map(([valorOpcao, rotulo]) => <option key={valorOpcao} value={valorOpcao}>{rotulo}</option>)}
    </select>
  );
}

function PastaAtalho({ ativo, nome, quantidade, onClick }: { ativo: boolean; nome: string; quantidade: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition " + (ativo ? "border-blue-400/50 bg-blue-500/15 text-blue-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white")}>
      <FolderOpen size={14} /> {nome}<span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px]">{quantidade}</span>
    </button>
  );
}

function EmpresaCard({ empresa, pastas, editando }: { empresa: EmpresaComProgresso; pastas: PastaChecklistResumo[]; editando: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosEmpresaChecklist>(() => dadosDoCard(empresa));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const atualizar = (campo: keyof DadosEmpresaChecklist, valor: string | null) => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    const resposta = await atualizarEmpresaChecklist(dados);
    setSalvando(false);
    if (resposta.error) {
      setErro(resposta.error);
      return;
    }
    router.refresh();
  };

  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/20">
      {!editando ? (
        <>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-black uppercase italic tracking-tight text-white">{empresa.razaoSocial}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{empresa.nomeFantasia || empresa.clienteNome}</p>
            </div>
            <Velocimetro percent={empresa.progressoReal} size="sm" />
          </div>
          <div className="grid grid-cols-2 gap-3 border-y border-white/5 py-4 text-xs">
            <Info titulo="CNPJ" valor={empresa.cnpj} />
            <Info titulo="Status" valor={empresa.status} />
            <Info titulo="Embasamento" valor={empresa.tipo ? TIPO_LABELS[empresa.tipo] : "Não definido"} />
            <Info titulo="Pasta" valor={empresa.pastaChecklistNome ?? "Sem pasta"} />
          </div>
          <Link
            href={"/PainelAlpha/CheckList/" + empresa.id}
            className="mt-5 flex items-center justify-center rounded-xl bg-blue-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-300 transition hover:bg-blue-500/20"
          >
            Ver checklist
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-blue-300">Editar empresa</p>
            <span className="text-[10px] font-bold text-slate-500">{empresa.clienteNome}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Campo label="Razão social" value={dados.razaoSocial} onChange={(valor) => atualizar("razaoSocial", valor)} />
            <Campo label="Nome fantasia" value={texto(dados.nomeFantasia)} onChange={(valor) => atualizar("nomeFantasia", valor || null)} />
            <Campo label="CNPJ" value={dados.cnpj} onChange={(valor) => atualizar("cnpj", valor)} />
            <Campo label="Status" value={dados.status} onChange={(valor) => atualizar("status", valor)} opcoes={[...new Set([...STATUS_EMPRESA, dados.status])]} />
            <Campo label="Tipo do checklist" value={dados.tipo ?? ""} onChange={(valor) => atualizar("tipo", valor || null)} opcoes={["", ...TIPOS]} formatar={(valor) => valor ? TIPO_LABELS[valor as TipoEmbasamento] : "Não definido"} />
            <Campo label="Pasta" value={dados.pastaChecklistId ?? ""} onChange={(valor) => atualizar("pastaChecklistId", valor || null)} opcoes={["", ...pastas.map((pasta) => pasta.id)]} formatar={(valor) => valor ? pastas.find((pasta) => pasta.id === valor)?.nome ?? valor : "Sem pasta"} />
            <Campo label="Embasamento cadastral" value={dados.embasamento} onChange={(valor) => atualizar("embasamento", valor)} />
            <Campo label="Mês de protocolo" value={texto(dados.mesProtocolo)} onChange={(valor) => atualizar("mesProtocolo", valor || null)} />
            <Campo label="Situação RADAR" value={texto(dados.situacaoRadar)} onChange={(valor) => atualizar("situacaoRadar", valor || null)} />
            <Campo label="Submodalidade" value={texto(dados.submodalidade)} onChange={(valor) => atualizar("submodalidade", valor || null)} />
            <Campo label="Município" value={texto(dados.municipio)} onChange={(valor) => atualizar("municipio", valor || null)} />
            <Campo label="UF" value={texto(dados.uf)} onChange={(valor) => atualizar("uf", valor || null)} />
            <Campo label="Regime tributário" value={texto(dados.regimeTributario)} onChange={(valor) => atualizar("regimeTributario", valor || null)} />
            <Campo label="Capital social" value={texto(dados.capitalSocial)} onChange={(valor) => atualizar("capitalSocial", valor || null)} />
            <Campo label="Data de constituição" value={texto(dados.dataConstituicao)} onChange={(valor) => atualizar("dataConstituicao", valor || null)} />
            <Campo label="Contribuinte" value={texto(dados.contribuinte)} onChange={(valor) => atualizar("contribuinte", valor || null)} />
          </div>
          <Campo label="Link do grupo" value={texto(dados.linkGrupo)} onChange={(valor) => atualizar("linkGrupo", valor || null)} />
          {erro && <p className="text-xs font-bold text-rose-300">{erro}</p>}
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar empresa
          </button>
        </div>
      )}
    </article>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{titulo}</p><p className="mt-1 truncate font-medium text-slate-300">{valor}</p></div>;
}

function Campo({ label, value, onChange, opcoes, formatar }: {
  label: string; value: string; onChange: (valor: string) => void; opcoes?: string[]; formatar?: (valor: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {opcoes ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50">
          {opcoes.map((opcao) => <option key={opcao || "vazio"} value={opcao}>{formatar ? formatar(opcao) : opcao}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50" />
      )}
    </label>
  );
}
