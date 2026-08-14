"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { CampoBpmInput } from "../CampoBpmInput";
import { MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM } from "@/lib/bpm/lost";
import {
  montarPayloadCamposDestino,
  prepararCamposMotivoLostUi,
  resolverSnapshotCamposRealtime,
  type SnapshotCamposRealtime,
} from "@/lib/bpm/card-modal-ui";
import {
  campoEhResumoAlinhamento,
  etapaEhAlinhamentoEstrategico,
  TEMPLATE_RESUMO_ALINHAMENTO,
} from "@/lib/bpm/alinhamento-estrategico";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type CamposEtapaCard = CardDetalhe["camposEtapa"];

interface Props {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
}

/** Editor dos campos da etapa atual. Deve viver exclusivamente na aba central
 * "Formulário da Etapa", jamais no modal de criação ou no painel direito. */
export function PainelCamposEtapaAtual({
  card,
  accent,
  podeEditar,
  realtimeRevision,
  onAtualizado,
}: Props) {
  const [revisaoInicial] = useState(realtimeRevision);
  const [valoresCamposAtuais, setValoresCamposAtuais] = useState<Record<string, string>>(() =>
    Object.fromEntries(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [baseCamposAtuais, setBaseCamposAtuais] = useState<Record<string, string>>(() =>
    Object.fromEntries(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [camposEtapaBase, setCamposEtapaBase] = useState(card.camposEtapa);
  const [versaoBaseCampos, setVersaoBaseCampos] = useState(() => new Date(card.updatedAt).toISOString());
  const snapshotAtivoRef = useRef<SnapshotCamposRealtime>({
    valores: Object.fromEntries(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""])),
    versao: new Date(card.updatedAt).toISOString(),
  });
  const [snapshotRemotoPendente, setSnapshotRemotoPendente] = useState<SnapshotCamposRealtime | null>(null);
  const [camposRemotosPendentes, setCamposRemotosPendentes] = useState<CamposEtapaCard | null>(null);
  const [conflitoCamposAtuais, setConflitoCamposAtuais] = useState(false);
  const camposAtuaisSujosRef = useRef(false);
  const [salvandoCamposAtuais, setSalvandoCamposAtuais] = useState(false);

  const configuracaoLostUi = prepararCamposMotivoLostUi(
    card.etapa.nome,
    camposEtapaBase,
    valoresCamposAtuais,
  );
  const camposAtuaisVisiveis = configuracaoLostUi.camposVisiveis;
  const complementoLostPendente = Boolean(
    configuracaoLostUi.exigeComplemento
    && configuracaoLostUi.campoComplementoId
    && !valoresCamposAtuais[configuracaoLostUi.campoComplementoId]?.trim(),
  );
  const resumoAlinhamento = camposEtapaBase.find((campo) => campoEhResumoAlinhamento(campo.nome));
  const alertaAlinhamento = etapaEhAlinhamentoEstrategico(card.etapa.nome)
    && Boolean(resumoAlinhamento)
    && !(valoresCamposAtuais[resumoAlinhamento?.id ?? ""] ?? "").trim();
  const camposAtuaisAlterados = camposAtuaisVisiveis.some(
    (campo) => (valoresCamposAtuais[campo.id] ?? "") !== (baseCamposAtuais[campo.id] ?? ""),
  );
  const snapshotCamposEtapa = JSON.stringify(card.camposEtapa);
  const versaoRemotaCampos = new Date(card.updatedAt).toISOString();

  useEffect(() => {
    const camposRemotos = JSON.parse(snapshotCamposEtapa) as CamposEtapaCard;
    const novosValores = Object.fromEntries(camposRemotos.map((campo) => [campo.id, campo.valor ?? ""]));
    const snapshotRemoto = { valores: novosValores, versao: versaoRemotaCampos };
    const timer = setTimeout(() => {
      const resolucao = resolverSnapshotCamposRealtime({
        rascunhoSujo: camposAtuaisSujosRef.current,
        snapshotAtual: snapshotAtivoRef.current,
        snapshotRemoto,
      });
      if (!resolucao.aplicarRemoto) {
        setSnapshotRemotoPendente(resolucao.snapshotPendente);
        setCamposRemotosPendentes(camposRemotos);
        setConflitoCamposAtuais(true);
        return;
      }
      snapshotAtivoRef.current = resolucao.snapshotAtivo;
      setValoresCamposAtuais(resolucao.snapshotAtivo.valores);
      setBaseCamposAtuais(resolucao.snapshotAtivo.valores);
      setVersaoBaseCampos(resolucao.snapshotAtivo.versao);
      setCamposEtapaBase(camposRemotos);
      setSnapshotRemotoPendente(null);
      setCamposRemotosPendentes(null);
      setConflitoCamposAtuais(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [snapshotCamposEtapa, versaoRemotaCampos, realtimeRevision]);

  function usarDadosAtualizadosCampos() {
    if (!snapshotRemotoPendente || !camposRemotosPendentes) return;
    setValoresCamposAtuais(snapshotRemotoPendente.valores);
    setBaseCamposAtuais(snapshotRemotoPendente.valores);
    setVersaoBaseCampos(snapshotRemotoPendente.versao);
    snapshotAtivoRef.current = snapshotRemotoPendente;
    setCamposEtapaBase(camposRemotosPendentes);
    setSnapshotRemotoPendente(null);
    setCamposRemotosPendentes(null);
    camposAtuaisSujosRef.current = false;
    setConflitoCamposAtuais(false);
  }

  async function salvarCamposAtuais() {
    if (!podeEditar || !camposAtuaisAlterados || conflitoCamposAtuais) return;
    if (complementoLostPendente) {
      toast.error(MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM);
      return;
    }
    const camposValores = montarPayloadCamposDestino(camposAtuaisVisiveis, valoresCamposAtuais);
    setSalvandoCamposAtuais(true);
    const resultado = await AtualizarCardBpm({
      cardId: card.id,
      camposValores,
      versaoEsperadaEm: versaoBaseCampos,
    });
    setSalvandoCamposAtuais(false);
    if (!resultado.success) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível salvar os campos da etapa");
      return;
    }
    toast.success("Campos da etapa atualizados");
    setBaseCamposAtuais((atual) => ({ ...atual, ...camposValores }));
    snapshotAtivoRef.current = {
      valores: { ...snapshotAtivoRef.current.valores, ...camposValores },
      versao: versaoBaseCampos,
    };
    camposAtuaisSujosRef.current = false;
    setConflitoCamposAtuais(false);
    onAtualizado();
  }

  const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";

  return (
    <section
      id={`campos-etapa-atual-${card.id}`}
      tabIndex={-1}
      className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      aria-labelledby={`campos-etapa-atual-titulo-${card.id}`}
    >
      {realtimeRevision !== revisaoInicial && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">
          Este card recebeu uma atualização em tempo real. Os valores que você está editando foram preservados; revise-os antes de salvar.
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}>
          <SlidersHorizontal size={13} style={{ color: `rgb(${accent})` }} />
        </div>
        <div>
          <h3 id={`campos-etapa-atual-titulo-${card.id}`} className="text-xs font-bold uppercase tracking-wide text-white">Campos da etapa atual</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{card.etapa.nome} · campos obrigatórios e opcionais.</p>
        </div>
      </div>

      {alertaAlinhamento && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-100">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-300" aria-hidden="true" />
          <p><strong>Chamada de alinhamento pendente.</strong> Cole o resumo da reunião para liberar o avanço da etapa.</p>
        </div>
      )}

      {camposAtuaisVisiveis.length === 0 ? (
        <p className="text-xs text-slate-500">Esta etapa não possui campos configurados.</p>
      ) : (
        <div className="space-y-3 border-t border-white/5 pt-3">
          {conflitoCamposAtuais && (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200" role="alert">
              <p>Os campos receberam uma atualização externa. Seu rascunho e a versão-base foram preservados; aceite os dados atualizados antes de continuar.</p>
              <button type="button" onClick={usarDadosAtualizadosCampos} className="mt-2 rounded-lg border border-sky-300/30 px-2 py-1 font-semibold hover:bg-sky-200/10">
                Usar dados atualizados
              </button>
            </div>
          )}
          {camposAtuaisVisiveis.map((campo) => {
            const complementoPendente = campo.id === configuracaoLostUi.campoComplementoId && complementoLostPendente;
            const descricaoId = complementoPendente ? `campo-bpm-${campo.id}-erro` : undefined;
            return (
              <div key={campo.id} className="space-y-1.5">
                <label htmlFor={`campo-bpm-${campo.id}`} className="text-[11px] font-medium text-slate-400">
                  {campo.nome}{campo.obrigatorio ? " *" : ""}
                </label>
                {campoEhResumoAlinhamento(campo.nome) && (
                  <button
                    type="button"
                    disabled={!podeEditar || Boolean(valoresCamposAtuais[campo.id]?.trim())}
                    onClick={() => {
                      camposAtuaisSujosRef.current = true;
                      setValoresCamposAtuais((atuais) => ({ ...atuais, [campo.id]: TEMPLATE_RESUMO_ALINHAMENTO }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-300/25 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ClipboardPaste size={12} aria-hidden="true" /> Usar template do resumo
                  </button>
                )}
                <CampoBpmInput
                  campo={campo}
                  value={valoresCamposAtuais[campo.id] ?? ""}
                  invalid={complementoPendente}
                  describedBy={descricaoId}
                  onChange={(valor) => {
                    camposAtuaisSujosRef.current = true;
                    setValoresCamposAtuais((atuais) => ({ ...atuais, [campo.id]: valor }));
                  }}
                  onBlur={() => void salvarCamposAtuais()}
                  className={inputCls}
                  disabled={!podeEditar}
                />
                {complementoPendente && (
                  <p id={descricaoId} role="alert" className="text-[11px] text-amber-300">
                    {MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM}
                  </p>
                )}
              </div>
            );
          })}
          {salvandoCamposAtuais && <p className="flex items-center gap-2 text-[11px] text-slate-500"><Loader2 size={13} className="animate-spin" /> Salvando alterações...</p>}
          {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode editar estes campos.</p>}
        </div>
      )}
    </section>
  );
}
