"use client";

import { useState } from "react";
import { Mail, Phone, Clock, UserPlus, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cnpjEhValido, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";
import AtribuirResponsavelPromocaoModal from "./AtribuirResponsavelPromocaoModal";

interface NolossLead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  receivedAt: Date | string;
}

interface Props {
  lead: NolossLead;
  pipelineId: string;
  accent: string;
  radarOpcoes: string[];
  currentUserId: number | null;
  onClose: () => void;
  onPromovido: () => void;
  onConfirmarPromocao: (responsavelId: number, cnpj?: string, radarPretendido?: string, qualificacao?: "Qualificado" | "Sem qualificação") => Promise<{ success: boolean; error?: string }>;
}

function formatarData(data: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

export default function NolossLeadModal({
  lead,
  pipelineId,
  accent,
  radarOpcoes,
  currentUserId,
  onClose,
  onPromovido,
  onConfirmarPromocao,
}: Props) {
  const [promocaoAberta, setPromocaoAberta] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [cnpjTocado, setCnpjTocado] = useState(false);
  const [radarPretendido, setRadarPretendido] = useState("");
  const [qualificacao, setQualificacao] = useState<"Qualificado" | "Sem qualificação" | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const nomeLead = lead.nome || lead.email || "Lead sem nome";
  const canalOrigem = lead.utmSource?.trim() || lead.utmMedium?.trim() || "NoLoss";
  const cnpjInvalido = Boolean(cnpj) && !cnpjEhValido(cnpj);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="h-[70vh] max-h-[70vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        <SheetTitle className="sr-only">Lead do site — {nomeLead}</SheetTitle>

        <div className="flex flex-col h-full">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/15" />
          </div>

          {/* Header */}
          <div className="px-6 sm:px-8 pt-2 pb-5 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, rgba(${accent},0.35), rgba(${accent},0.08))`,
                    boxShadow: `0 8px 24px -8px rgba(${accent},0.5)`,
                  }}
                >
                  <UserPlus size={19} style={{ color: `rgb(${accent})` }} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-black text-white tracking-tight truncate">{nomeLead}</h1>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Lead do site</span>
                    <span className="text-slate-700">·</span>
                    <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">Origem: {canalOrigem}</span>
                    <span className="text-slate-700">·</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                      Pendente
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Corpo */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Dados do lead</h3>

              <div className="space-y-2.5">
                {erro && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p>}
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-medium text-slate-500 w-20 shrink-0">Nome</span>
                  <span className="text-sm text-white">{lead.nome || "—"}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-medium text-slate-500 w-20 shrink-0">E-mail</span>
                  <span className="text-sm text-white flex items-center gap-1.5">
                    <Mail size={12} className="text-slate-500 shrink-0" aria-hidden="true" />
                    {lead.email || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-medium text-slate-500 w-20 shrink-0">Telefone</span>
                  <span className="text-sm text-white flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-500 shrink-0" aria-hidden="true" />
                    {lead.telefone || "—"}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="noloss-lead-radar" className="block text-[11px] font-medium text-slate-300">Radar pretendido *</label>
                  <select
                    id="noloss-lead-radar"
                    value={radarPretendido}
                    onChange={(event) => { setRadarPretendido(event.target.value); setErro(null); }}
                    disabled={radarOpcoes.length === 0}
                    required
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option value="">Selecione...</option>
                    {radarOpcoes.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                  </select>
                  {radarOpcoes.length === 0 && <p role="status" className="text-[11px] text-amber-300">Configure as opções de Radar pretendido no editor do pipeline para assumir leads.</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="noloss-lead-qualificacao" className="block text-[11px] font-medium text-slate-300">Qualificação</label>
                  <select
                    id="noloss-lead-qualificacao"
                    value={qualificacao}
                    onChange={(event) => setQualificacao(event.target.value as typeof qualificacao)}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  >
                    <option value="">Não definida</option>
                    <option value="Qualificado">Qualificado</option>
                    <option value="Sem qualificação">Sem qualificação</option>
                  </select>
                </div>
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="noloss-lead-cnpj" className="block text-[11px] font-medium text-slate-300">
                    CNPJ <span className="font-normal text-slate-500">(opcional para lead do site)</span>
                  </label>
                  <input
                    id="noloss-lead-cnpj"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cnpj}
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    aria-invalid={cnpjTocado && cnpjInvalido}
                    aria-describedby="noloss-lead-cnpj-ajuda"
                    onChange={(event) => setCnpj(formatarCNPJProgressivo(event.target.value))}
                    onBlur={() => setCnpjTocado(true)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                  />
                  <p id="noloss-lead-cnpj-ajuda" className={cnpjTocado && cnpjInvalido ? "text-[11px] text-rose-300" : "text-[11px] text-slate-500"}>
                    {cnpjTocado && cnpjInvalido
                      ? "Informe um CNPJ válido ou deixe o campo vazio."
                      : "Se informado, o CNPJ será salvo ao assumir o lead."}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-medium text-slate-500 w-20 shrink-0">Recebido em</span>
                  <span className="text-sm text-white flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-500 shrink-0" aria-hidden="true" />
                    {formatarData(lead.receivedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Este lead veio do site e ainda não foi assumido por nenhum responsável.
                Ao promover, ele vira uma empresa e um card real na pipeline.
              </p>
            </div>
          </div>

          {/* Rodapé */}
          <div className="shrink-0 border-t border-white/5 p-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                setCnpjTocado(true);
                if (cnpjInvalido) return;
                if (!radarPretendido || !radarOpcoes.includes(radarPretendido)) {
                  setErro("Selecione um Radar pretendido válido.");
                  return;
                }
                setErro(null);
                setPromocaoAberta(true);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: `rgba(${accent},0.85)` }}
            >
              Assumir lead
            </button>
          </div>
        </div>

        {promocaoAberta && (
          <AtribuirResponsavelPromocaoModal
            pipelineId={pipelineId}
            nomeLead={nomeLead}
            etapaDestinoNome="Novos leads"
            currentUserId={currentUserId}
            accent={accent}
            radarOpcoes={radarOpcoes}
            radarPretendidoInicial={radarPretendido}
            onConfirmar={async (responsavelId, radarEscolhido) => {
              const resultado = await onConfirmarPromocao(
                responsavelId,
                cnpj ? normalizarCNPJ(cnpj) : undefined,
                radarEscolhido,
                qualificacao || undefined,
              );
              if (resultado.success) {
                toast.success("Lead promovido com sucesso!");
                setPromocaoAberta(false);
                onPromovido();
              }
              return resultado;
            }}
            onCancelar={() => setPromocaoAberta(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
