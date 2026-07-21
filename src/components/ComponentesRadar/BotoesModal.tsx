"use client";

import { useState } from "react";
import { RefreshCw, AlertTriangle, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ModalHistorico from "./ModalHistorico";
import FiltrosTabela from "./FiltroTabela/FiltroTabela";
import { getTema } from "@/lib/temas";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Modal config ─────────────────────────────────────────────────────────────

const MODAL_CONFIG = {
  limpar: {
    titulo: "Limpar tabela?",
    texto: (
      <>
        Ao limpar, <strong>todos os registros exibidos serão apagados</strong>, incluindo dados
        salvos no navegador.
        <br />
        <strong>Essa ação não pode ser desfeita.</strong>
      </>
    ),
    confirmarTexto: "Sim, limpar tudo",
  },
  exportar: {
    titulo: "Exportar Excel?",
    texto: <>Defina um nome para o arquivo antes de exportar.</>,
    confirmarTexto: "Sim, exportar",
  },
  reconsultar: {
    titulo: "Reconsultar erros?",
    texto: (
      <>
        Os registros com problemas serão consultados novamente.
        <br />
        Este processo pode levar alguns minutos.
      </>
    ),
    confirmarTexto: "Sim, reconsultar",
  },
} as const;

type AcaoModal = "limpar" | "exportar" | "reconsultar" | "duplicado" | null;
type ModalAberto = "historico" | null;

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  onImportarHistorico: (ids: number[]) => void;
  onLimparTabela: () => void;
  onExportarExcel: (nome: string) => void;
  onReconsultarErros: () => void;
  processando: boolean;
  empresas: any[];
  selecionados: Set<string>;
  ordem: "todos" | "asc" | "desc" | null;
  ordemData: "todos" | "recentes" | "antigos" | null;
  empresasExibidas: any[];
  handleAlternarOrdemNome: () => void;
  handleAlternarOrdemData: () => void;
  handleRemoverSelecionados: () => void;
  handleSelecionarTudo: () => void;
  filtroErro: boolean;
  setFiltroErro: (v: boolean) => void;
  loading: boolean;
  totalEmpresas: number;
  setOrdem: (v: "todos" | "asc" | "desc" | null) => void;
  setOrdemData: (v: "todos" | "recentes" | "antigos" | null) => void;
  onSalvarBanco: (nome: string) => Promise<any>;
  filtroStatus: "todos" | "erro" | "sucesso";
  setFiltroStatus: (v: "todos" | "erro" | "sucesso") => void;
  cnpjsSelecionadosNoBanco: string[];
  excluindoDoBanco: boolean;
  progressoExclusao: { atual: number; total: number };
  onIniciarExclusaoDoBanco: () => void;
  totalSelecionados: number;
  filtroSituacao: "todos" | "DEFERIDA" | "NÃO HABILITADA" | "SUSPENSA" | "SEM STATUS";
  setFiltroSituacao: React.Dispatch<
    React.SetStateAction<
      "todos" | "DEFERIDA" | "NÃO HABILITADA" | "SUSPENSA" | "SEM STATUS"
    >
  >;
  onAbrirReconsulta: () => void;
  filtroSubmodalidade:
    | "todos"
    | "LIMITADA (ATÉ US$ 50.000)"
    | "LIMITADA (ATÉ US$ 150.000)"
    | "ILIMITADA";
  setFiltroSubmodalidade: React.Dispatch<
    React.SetStateAction<
      | "todos"
      | "LIMITADA (ATÉ US$ 50.000)"
      | "LIMITADA (ATÉ US$ 150.000)"
      | "ILIMITADA"
    >
  >;
  tema?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModalButtons({
  onImportarHistorico,
  onLimparTabela,
  onExportarExcel,
  onReconsultarErros,
  processando,
  empresas,
  selecionados,
  ordem,
  ordemData,
  empresasExibidas,
  handleAlternarOrdemNome,
  handleAlternarOrdemData,
  handleRemoverSelecionados,
  handleSelecionarTudo,
  filtroErro,
  setFiltroErro,
  loading,
  onSalvarBanco,
  totalEmpresas,
  setOrdem,
  setOrdemData,
  filtroStatus,
  setFiltroStatus,
  cnpjsSelecionadosNoBanco,
  excluindoDoBanco,
  progressoExclusao,
  onIniciarExclusaoDoBanco,
  totalSelecionados,
  filtroSituacao,
  setFiltroSituacao,
  onAbrirReconsulta,
  filtroSubmodalidade,
  setFiltroSubmodalidade,
  tema = "blue",
}: Props) {
  const visual = getTema(tema);
  const [acaoModal, setAcaoModal] = useState<AcaoModal>(null);
  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);
  const [nomeArquivo, setNomeArquivo] = useState("consulta_radar");
  const [enabled, setEnabled] = useState(true);
  const [modalExcluirBancoAberto, setModalExcluirBancoAberto] = useState(false);
  const [iniciouExclusao, setIniciouExclusao] = useState(false);
  const totalNoBanco = cnpjsSelecionadosNoBanco.length;
  const progressoPercentual =
    progressoExclusao.total > 0
      ? Math.round((progressoExclusao.atual / progressoExclusao.total) * 100)
      : 0;
  const faseExclusao: "confirmar" | "progresso" | "concluido" = !iniciouExclusao
    ? "confirmar"
    : excluindoDoBanco
    ? "progresso"
    : "concluido";

  function abrirModalExcluirBanco() {
    setIniciouExclusao(false);
    setModalExcluirBancoAberto(true);
  }

  function confirmarExclusaoDoBanco() {
    setIniciouExclusao(true);
    onIniciarExclusaoDoBanco();
  }

  function fecharModalExcluirBanco() {
    setModalExcluirBancoAberto(false);
    setIniciouExclusao(false);
  }

  function fecharTudo() {
    setAcaoModal(null);
    setModalAberto(null);
  }

  async function confirmarAcao() {
    if (acaoModal === "limpar") {
      onLimparTabela();
      fecharTudo();
      return;
    }

    if (acaoModal === "exportar" || acaoModal === "duplicado") {
      if (empresas.length === 0) {
        toast.error("A tabela está vazia!");
        fecharTudo();
        return;
      }
      if (enabled) {
        try {
          const res = await onSalvarBanco(nomeArquivo);
          if (res?.error === "duplicado") {
            setAcaoModal("duplicado");
            return;
          }
          if (res && !res.success) toast.error("Erro ao salvar, mas o arquivo será exportado.");
        } catch {}
      }
      onExportarExcel(nomeArquivo);
      fecharTudo();
      return;
    }

    if (acaoModal === "reconsultar") {
      onReconsultarErros();
      fecharTudo();
    }
  }

  const config =
    acaoModal && acaoModal !== "duplicado" ? MODAL_CONFIG[acaoModal] : null;

  // ── Shared button styles ───────────────────────────────────────────────────
  const btnPrimary =
    "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all whitespace-nowrap";
  const btnSecondary =
    "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all whitespace-nowrap";

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <section
        className="flex items-center flex-wrap gap-2 pt-5 border-t"
        style={{ borderColor: `rgba(${visual.accent},0.15)` }}
      >
        <button
          className={btnPrimary}
          style={{ background: `rgba(${visual.accent},0.8)` }}
          onClick={() => setAcaoModal("exportar")}
        >
          📊 Exportar Excel
        </button>

        <button className={btnSecondary} onClick={() => setAcaoModal("limpar")}>
          🧹 Limpar tabela
        </button>

        <button
          className={`${btnSecondary} flex items-center gap-2`}
          onClick={onAbrirReconsulta}
          disabled={processando}
        >
          <RefreshCw className={processando ? "animate-spin" : ""} size={14} />
          {processando ? "Processando..." : "Reconsultar"}
        </button>

        <button
          className={btnSecondary}
          onClick={() => setModalAberto("historico")}
        >
          📜 Histórico
        </button>

        <button
          onClick={() => onSalvarBanco(nomeArquivo)}
          disabled={loading || totalEmpresas === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
        >
          <Database size={14} className={loading ? "animate-pulse" : ""} />
          {loading ? "Salvando..." : "Salvar"}
        </button>

        <FiltrosTabela
          totalSelecionados={selecionados.size}
          ordem={ordem}
          ordemData={ordemData}
          onAlternarOrdemNome={handleAlternarOrdemNome}
          onAlternarOrdemData={handleAlternarOrdemData}
          onRemoverSelecionados={handleRemoverSelecionados}
          onSelecionarTodos={handleSelecionarTudo}
          todosSelecionados={
            selecionados.size === empresasExibidas.length && empresasExibidas.length > 0
          }
          filtroErro={filtroErro}
          setFiltroErro={setFiltroErro}
          loading={loading}
          totalEmpresas={empresas.length}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          filtroSituacao={filtroSituacao}
          setOrdem={setOrdem}
          setOrdemData={setOrdemData}
          setFiltroSituacao={setFiltroSituacao}
          filtroSubmodalidade={filtroSubmodalidade}
          setFiltroSubmodalidade={setFiltroSubmodalidade}
        />

        <button
          onClick={handleRemoverSelecionados}
          disabled={totalSelecionados === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
            totalSelecionados > 0
              ? "bg-rose-600 border-rose-500 text-white shadow-lg hover:bg-rose-700 active:scale-95"
              : "bg-white/5 border-white/10 text-slate-500 cursor-not-allowed"
          }`}
        >
          <Trash2 size={14} />
          Excluir ({totalSelecionados})
        </button>

        <button
          onClick={abrirModalExcluirBanco}
          disabled={totalNoBanco === 0 || excluindoDoBanco}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
            totalNoBanco > 0 && !excluindoDoBanco
              ? "bg-purple-950 border-purple-800 text-white shadow-lg hover:bg-purple-900 active:scale-95"
              : "bg-white/5 border-white/10 text-slate-500 cursor-not-allowed"
          }`}
        >
          <Database size={14} />
          Excluir do banco ({totalNoBanco})
        </button>

        <AlertDialog
          open={modalExcluirBancoAberto}
          onOpenChange={(open) => {
            if (!open && faseExclusao !== "progresso") fecharModalExcluirBanco();
          }}
        >
          <AlertDialogContent>
            {faseExclusao === "confirmar" && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-purple-500" size={20} aria-hidden="true" />
                    Excluir do banco de dados?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{totalNoBanco}</strong> registro{totalNoBanco !== 1 ? "s" : ""}{" "}
                    será{totalNoBanco !== 1 ? "ão" : ""}{" "}
                    <strong>excluído{totalNoBanco !== 1 ? "s" : ""} permanentemente</strong> do
                    banco de dados de produção.
                    <br />
                    Os itens continuam na tabela para consulta — só param de estar sincronizados
                    com o banco.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <button
                    onClick={confirmarExclusaoDoBanco}
                    className={`${btnPrimary} !bg-purple-950 hover:!bg-purple-900`}
                  >
                    Sim, excluir do banco
                  </button>
                </AlertDialogFooter>
              </>
            )}

            {faseExclusao === "progresso" && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluindo do banco...</AlertDialogTitle>
                  <AlertDialogDescription>
                    {progressoExclusao.atual} / {progressoExclusao.total} processados. Não feche
                    esta janela.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden my-2">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${progressoPercentual}%` }}
                  />
                </div>
              </>
            )}

            {faseExclusao === "concluido" && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Database className="text-purple-500" size={20} aria-hidden="true" />
                    Exclusão concluída
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {progressoExclusao.atual} de {progressoExclusao.total} registro
                    {progressoExclusao.total !== 1 ? "s" : ""} processado
                    {progressoExclusao.total !== 1 ? "s" : ""}. Veja o resumo no aviso da tela.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <button onClick={fecharModalExcluirBanco} className={`${btnPrimary} !bg-purple-950 hover:!bg-purple-900`}>
                    Fechar
                  </button>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* ── Histórico modal ──────────────────────────────────────────────────── */}
      {modalAberto === "historico" && (
        <ModalHistorico
          onImportar={(ids) => {
            onImportarHistorico(ids);
            fecharTudo();
          }}
          onClose={fecharTudo}
        />
      )}

      {/* ── Confirm modal ────────────────────────────────────────────────────── */}
      {config && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[999]">
          <div className="w-full max-w-[460px] mx-4 p-6 rounded-3xl bg-[#0b1120] border border-slate-700/60 shadow-[0_26px_70px_rgba(2,6,23,0.95)]">
            <h2 className="text-lg font-bold text-slate-100 mb-2">{config.titulo}</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">{config.texto}</p>

            {acaoModal === "exportar" && (
              <div className="mt-4 space-y-3">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  Nome do Arquivo
                </label>
                <input
                  type="text"
                  value={nomeArquivo}
                  onChange={(e) => setNomeArquivo(e.target.value)}
                  placeholder="Ex: consulta_radar"
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-slate-500 transition-all"
                />
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                  <div>
                    <p className="text-xs font-bold text-slate-300">Salvar no Banco?</p>
                    <p className="text-[10px] text-slate-500 uppercase">
                      Armazena no histórico
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={enabled}
                      onChange={() => setEnabled((v) => !v)}
                    />
                    <div
                      className="w-11 h-6 bg-slate-800 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-full"
                      style={{ ["--tw-peer-checked-bg" as any]: `rgb(${visual.accent})` }}
                    >
                      <style>{`input:checked + div { background-color: rgba(${visual.accent}, 0.8) !important; }`}</style>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button className={btnSecondary} onClick={fecharTudo}>
                Cancelar
              </button>
              <button
                className={`${btnPrimary} min-w-[120px] justify-center`}
                style={{ background: `rgba(${visual.accent},0.85)` }}
                onClick={confirmarAcao}
              >
                {config.confirmarTexto}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate name modal ─────────────────────────────────────────────── */}
      {acaoModal === "duplicado" && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[999]">
          <div className="w-full max-w-sm mx-4 p-6 rounded-3xl bg-[#0b1120] border border-slate-700/60 shadow-[0_26px_70px_rgba(2,6,23,0.95)]">
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertTriangle size={22} />
              <h2 className="text-lg font-bold">Nome já existe!</h2>
            </div>
            <p className="text-slate-400 text-sm mb-5">
              Já existe uma planilha chamada{" "}
              <span className="text-white font-bold">"{nomeArquivo}"</span>. Escolha um novo
              nome:
            </p>
            <input
              type="text"
              value={nomeArquivo}
              onChange={(e) => setNomeArquivo(e.target.value)}
              className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white mb-5 outline-none focus:border-amber-500 transition-all"
            />
            <div className="flex justify-end gap-3">
              <button className={btnSecondary} onClick={fecharTudo}>
                Cancelar
              </button>
              <button
                className={`${btnPrimary} min-w-[120px] justify-center !bg-amber-600 hover:!bg-amber-500`}
                onClick={confirmarAcao}
              >
                Renomear e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
