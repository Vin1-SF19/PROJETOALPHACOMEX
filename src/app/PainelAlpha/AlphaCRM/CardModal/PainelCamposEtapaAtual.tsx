"use client";
import { criarRastreadorRascunho } from "@/lib/bpm/rascunho-versionado";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Loader2, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { ConsultarCnpjNovoContrato } from "@/actions/bpm/ConsultaCnpjFinanceiro";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM } from "@/lib/bpm/lost";
import { CHAVES_CAMPOS, VALORES } from "@/lib/bpm/financeiro-config.client";
import {
  montarPayloadCamposDestino,
  prepararCamposMotivoLostUiCanonico,
  resolverSnapshotCamposRealtime,
  type SnapshotCamposRealtime,
} from "@/lib/bpm/card-modal-ui";
import { TEMPLATE_RESUMO_ALINHAMENTO } from "@/lib/bpm/alinhamento-estrategico";
import { BPM_FIELD_KEYS, BPM_STAGE_KEYS } from "@/lib/bpm/ontology";
import { FINANCIAL_FIELD_KEYS } from "@/lib/bpm/pipeline-financeiro";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";
import { useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
const erroFormulario = { duration: 5000, closeButton: true };
// Só a apresentação do CPF é ignorada; outros tipos mantêm comparação literal.
function valorComparavel(tipo: string, valor = "") {
  return tipo === "cpf" ? valor.replace(/[.\-\s]/g, "") : valor;
}
type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type CamposEtapaCard = CardDetalhe["camposEtapa"];
interface Props {
  card: CardDetalhe;
  campoIds: string[];
  campoLabels?: Record<string, string>;
  instanceKey: string;
  titulo?: string;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
}
/** Editor dos campos da etapa atual. Deve viver exclusivamente na aba central
 * "Formulário da Etapa", jamais no modal de criação ou no painel direito. */
export function PainelCamposEtapaAtual({
  card,
  campoIds,
  campoLabels = {},
  instanceKey,
  titulo = "Campos da etapa atual",
  accent,
  podeEditar,
  realtimeRevision,
  onAtualizado,
}: Props) {
  const { registerSave, registerManualSave, getPendingUpload, setPendingUpload, setPendingFields, getVersion, confirmVersion, getDraft, setDraft, subscribeConfirmation, getFailedSaveKeys, clearFailedSave } = useCardSave();
  const idInstancia = `${card.id}-${instanceKey}`;
  const ordemCampos = new Map(campoIds.map((id, indice) => [id, indice]));
  const camposDoComponente = card.camposEtapa
    .filter((campo) => ordemCampos.has(campo.id))
    .sort((a, b) => (ordemCampos.get(a.id) ?? 0) - (ordemCampos.get(b.id) ?? 0));
  const [revisaoInicial] = useState(realtimeRevision);
  const [valoresCamposAtuais, setValoresCamposAtuais] = useState<Record<string, string>>(() =>
    getDraft(idInstancia) ?? Object.fromEntries(camposDoComponente.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [valoresConfirmados, setBaseCamposAtuais] = useState<Record<string, string>>(() =>
    Object.fromEntries(camposDoComponente.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [camposEtapaBase, setCamposEtapaBase] = useState(camposDoComponente);
  const [versaoBaseCampos, setVersaoBaseCampos] = useState(() => new Date(card.updatedAt).toISOString());
  const versaoBaseCamposRef = useRef(versaoBaseCampos);
  const snapshotAtivoRef = useRef<SnapshotCamposRealtime>({
    valores: Object.fromEntries(camposDoComponente.map((campo) => [campo.id, campo.valor ?? ""])),
    versao: new Date(card.updatedAt).toISOString(),
  });
  const [snapshotRemotoPendente, setSnapshotRemotoPendente] = useState<SnapshotCamposRealtime | null>(null);
  const [camposRemotosPendentes, setCamposRemotosPendentes] = useState<CamposEtapaCard | null>(null);
  const [conflitoCamposAtuais, setConflitoCamposAtuais] = useState(false);
  const camposAtuaisSujosRef = useRef(false);
  const [savesCamposPendentes, setSavesCamposPendentes] = useState(0);
  const [progressoSave, setProgressoSave] = useState<{ concluido: number; total: number } | null>(null);
  const salvandoManualRef = useRef(false);
  const [arquivosIniciais] = useState(() => new Map(camposDoComponente.flatMap((campo) => {
    const upload = getPendingUpload(`${card.id}:arquivo:${campo.id}`);
    return upload ? [[campo.id, upload] as const] : [];
  })));
  const arquivosPendentesRef = useRef(arquivosIniciais);
  const [arquivosPendentes, setArquivosPendentes] = useState<Record<string, string>>(() =>
    Object.fromEntries([...arquivosIniciais].map(([id, upload]) => [id, upload.nome])));

  const [estadoSave, setEstadoSave] = useState<"pendente" | "salvo" | "erro" | "invalido" | null>(null);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const cnpjConsultadoRef = useRef("");
  const revisaoEdicao = useRef(0);
  const valoresRef = useRef(valoresCamposAtuais);
  const rastreadores = useRef(new Map<string, ReturnType<typeof criarRastreadorRascunho>>());
  useEffect(() => subscribeConfirmation(card.id, (confirmed, key) => {
    if (!key?.startsWith(`${card.id}:arquivo:`)) return;
    const campoId = key.slice(`${card.id}:arquivo:`.length);
    const campo = confirmed.camposEtapa.find((item) => item.id === campoId);
    if (!campo || !(campoId in valoresRef.current)) return;
    const valor = campo.valor ?? "";
    valoresRef.current = { ...valoresRef.current, [campoId]: valor };
    snapshotAtivoRef.current = {
      valores: { ...snapshotAtivoRef.current.valores, [campoId]: valor },
      versao: new Date(confirmed.updatedAt).toISOString(),
    };
    versaoBaseCamposRef.current = snapshotAtivoRef.current.versao;
    const draft = getDraft(idInstancia);
    if (draft) setDraft(idInstancia, { ...draft, [campoId]: valor });
    setValoresCamposAtuais(valoresRef.current);
    setBaseCamposAtuais(snapshotAtivoRef.current.valores);
  }), [card.id, idInstancia, getDraft, setDraft, subscribeConfirmation]);

  function atualizarPendencias(antesDaConfirmacao?: Record<string, string>) {
    // Uma montagem anterior não pode apagar o rascunho editado após reabrir.
    const compartilhado = getDraft(idInstancia);
    if (antesDaConfirmacao && compartilhado && Object.entries(compartilhado)
      .some(([id, valor]) => valor !== antesDaConfirmacao[id])) return;
    const pendentes = camposEtapaBase.filter((campo) =>
      valorComparavel(campo.tipo, valoresRef.current[campo.id]) !== valorComparavel(campo.tipo, snapshotAtivoRef.current.valores[campo.id]));
    camposAtuaisSujosRef.current = pendentes.length > 0;
    setDraft(idInstancia, pendentes.length ? { ...valoresRef.current } : undefined);
    setPendingFields(`${card.id}:${idInstancia}`, pendentes.map((campo) => ({
      label: campoLabels[campo.id] ?? campo.nome,
      before: snapshotAtivoRef.current.valores[campo.id] ?? "",
      after: valoresRef.current[campo.id] ?? "",
    })));
  }
  function alterarCampo(id: string, valor: string) {
    const campo = camposEtapaBase.find((item) => item.id === id);
    if (campo?.tipo === "cpf" && valorComparavel("cpf", valor) === valorComparavel("cpf", valoresRef.current[id])) return;
    revisaoEdicao.current += 1;
    setEstadoSave("pendente");
    let rastreador = rastreadores.current.get(id);
    if (!rastreador) {
      rastreador = criarRastreadorRascunho(valoresRef.current[id] ?? "");
      rastreadores.current.set(id, rastreador);
    }
    rastreador.alterar(valor);
    if (arquivosPendentesRef.current.delete(id)) {
      setPendingUpload(`${card.id}:arquivo:${id}`);
      setArquivosPendentes((atual) => { const proximo = { ...atual }; delete proximo[id]; return proximo; });
      setPendingFields(`${card.id}:arquivo:${id}`, []);
    }
    valoresRef.current = { ...valoresRef.current, [id]: valor };
    atualizarPendencias();
    setValoresCamposAtuais(valoresRef.current);
  }
  const configuracaoLostUi = prepararCamposMotivoLostUiCanonico(
    card.etapa.chave,
    camposEtapaBase,
    valoresCamposAtuais,
  );
  const camposAtuaisVisiveis = configuracaoLostUi.camposVisiveis;
  const totalCamposAlterados = camposAtuaisVisiveis.filter((campo) => Object.hasOwn(arquivosPendentes, campo.id)
    || (!campo.somenteLeitura && campo.editavel !== false
    && valorComparavel(campo.tipo, valoresCamposAtuais[campo.id]) !== valorComparavel(campo.tipo, valoresConfirmados[campo.id]))).length;
  const complementoLostPendente = Boolean(
    configuracaoLostUi.exigeComplemento
    && configuracaoLostUi.campoComplementoId
    && !valoresCamposAtuais[configuracaoLostUi.campoComplementoId]?.trim(),
  );
  const resumoAlinhamento = camposEtapaBase.find((campo) => campo.chave === BPM_FIELD_KEYS.MEETING_SUMMARY);
  const alertaAlinhamento = card.etapa.chave === BPM_STAGE_KEYS.ALINHAMENTO_ESTRATEGICO
    && Boolean(resumoAlinhamento)
    && !(valoresCamposAtuais[resumoAlinhamento?.id ?? ""] ?? "").trim();
  const snapshotCamposEtapa = JSON.stringify(camposDoComponente);
  const versaoRemotaCampos = new Date(card.updatedAt).toISOString();
  useEffect(() => {
    const camposRemotos = JSON.parse(snapshotCamposEtapa) as CamposEtapaCard;
    const novosValores = Object.fromEntries(camposRemotos.map((campo) => [campo.id, campo.valor ?? ""]));
    const snapshotRemoto = { valores: novosValores, versao: versaoRemotaCampos };
    const timer = setTimeout(() => {
      if (snapshotRemoto.versao < snapshotAtivoRef.current.versao) return;
      // A própria confirmação pode chegar pelo realtime após uma nova edição.
      // A mesma versão já confirmada não representa conflito externo.
      if ((camposAtuaisSujosRef.current || getDraft(idInstancia)) && snapshotRemoto.versao === snapshotAtivoRef.current.versao) return;
      const resolucao = resolverSnapshotCamposRealtime({
        rascunhoSujo: camposAtuaisSujosRef.current || Boolean(getDraft(idInstancia)),
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
      valoresRef.current = resolucao.snapshotAtivo.valores;
      setValoresCamposAtuais(resolucao.snapshotAtivo.valores);
      setBaseCamposAtuais(resolucao.snapshotAtivo.valores);
      setVersaoBaseCampos(resolucao.snapshotAtivo.versao);
      versaoBaseCamposRef.current = resolucao.snapshotAtivo.versao;
      setCamposEtapaBase(camposRemotos);
      setSnapshotRemotoPendente(null);
      setCamposRemotosPendentes(null);
      setConflitoCamposAtuais(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [snapshotCamposEtapa, versaoRemotaCampos, realtimeRevision, getDraft, idInstancia]);
  function usarDadosAtualizadosCampos() {
    if (!snapshotRemotoPendente || !camposRemotosPendentes) return;
    const chavesDestaSecao = new Set(camposEtapaBase.map((campo) => `${card.id}:campo:${campo.id}`));
    chavesDestaSecao.add(`${card.id}:campo:${instanceKey}`);
    for (const key of getFailedSaveKeys(card.id)) if (chavesDestaSecao.has(key)) clearFailedSave(key);
    valoresRef.current = snapshotRemotoPendente.valores;
    rastreadores.current.clear();
    setPendingFields(`${card.id}:${idInstancia}`, []);
    setDraft(idInstancia);
    setValoresCamposAtuais(snapshotRemotoPendente.valores);
    setBaseCamposAtuais(snapshotRemotoPendente.valores);
    setVersaoBaseCampos(snapshotRemotoPendente.versao);
    versaoBaseCamposRef.current = snapshotRemotoPendente.versao;
    snapshotAtivoRef.current = snapshotRemotoPendente;
    setCamposEtapaBase(camposRemotosPendentes);
    setSnapshotRemotoPendente(null);
    setCamposRemotosPendentes(null);
    camposAtuaisSujosRef.current = false;
    setConflitoCamposAtuais(false);
  }
  async function salvarCamposAtuais(campoId: string): Promise<boolean> {
    if (!podeEditar || conflitoCamposAtuais) return false;
    const valoresAtuais = getDraft(idInstancia) ?? valoresRef.current;
    const configuracaoAtual = prepararCamposMotivoLostUiCanonico(card.etapa.chave, camposEtapaBase, valoresAtuais);
    if (configuracaoAtual.exigeComplemento && configuracaoAtual.campoComplementoId
      && !valoresAtuais[configuracaoAtual.campoComplementoId]?.trim()) {
      toast.error(MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM, erroFormulario);
      setEstadoSave("invalido");
      return false;
    }
    const revisaoEnviada = revisaoEdicao.current;
    const revisoes = new Map(configuracaoAtual.camposVisiveis.map((campo) => [campo.id, rastreadores.current.get(campo.id)?.capturar()]));
    let erroDaTentativa = "Não foi possível salvar os campos da etapa.";
    setSavesCamposPendentes((total) => total + 1);
    const promise = registerSave(async () => {
      // Compare após os saves anteriores: uma reversão pode coincidir com a base
      // antiga no blur, mas precisar de persistência quando chegar sua vez.
      const camposValores: Record<string, string> = {};
      let possuiValorInvalido = false;
      for (const campo of configuracaoAtual.camposVisiveis) {
        if (campoId && campo.id !== campoId && !configuracaoAtual.exigeComplemento) continue;
        if (campo.somenteLeitura || campo.editavel === false
          || valorComparavel(campo.tipo, valoresAtuais[campo.id]) === valorComparavel(campo.tipo, snapshotAtivoRef.current.valores[campo.id])) continue;
        const validacao = validarValoresCamposBpm([campo], montarPayloadCamposDestino([campo], valoresAtuais));
        if (!validacao.success) { possuiValorInvalido = true; toast.error(validacao.error, erroFormulario); continue; }
        Object.assign(camposValores, validacao.valores);
      }
      if (!Object.keys(camposValores).length) {
        if (possuiValorInvalido && revisaoEdicao.current === revisaoEnviada) setEstadoSave("invalido");
        return !possuiValorInvalido;
      }
      const valoresAntesDaRequisicao = { ...valoresRef.current };
      const baseAntesDaRequisicao = { ...snapshotAtivoRef.current.valores };
      const atualizar = (versao: string) => AtualizarCardBpm({
        cardId: card.id, camposValores, versaoEsperadaEm: versao,
      });
      let resultado;
      let camposRemotos: Record<string, string> = {};
      try {
        resultado = await atualizar(getVersion(card.id, versaoBaseCamposRef.current));
        if (!resultado.success && resultado.error === "O card mudou enquanto era editado. Recarregue e tente novamente.") {
          const remoto = await ObterCardBpm(card.id);
          if (remoto.success && remoto.data && remoto.data.etapa.id === card.etapa.id) {
            const porId = new Map(remoto.data.camposEtapa.map((campo) => [campo.id, campo]));
            const semConflitoNoCampo = Object.keys(camposValores).every((id) => {
              const campoRemoto = porId.get(id);
              const campoLocal = configuracaoAtual.camposVisiveis.find((campo) => campo.id === id);
              return campoRemoto && campoLocal
                && valorComparavel(campoLocal.tipo, campoRemoto.valor ?? "")
                  === valorComparavel(campoLocal.tipo, snapshotAtivoRef.current.valores[id]);
            });
            if (semConflitoNoCampo) {
              const versaoRemota = new Date(remoto.data.updatedAt).toISOString();
              camposRemotos = Object.fromEntries(remoto.data.camposEtapa
                .filter((campo) => Object.hasOwn(snapshotAtivoRef.current.valores, campo.id))
                .map((campo) => [campo.id, campo.valor ?? ""]));
              confirmVersion(card.id, versaoRemota);
              versaoBaseCamposRef.current = versaoRemota;
              resultado = await atualizar(versaoRemota);
            } else {
              setSnapshotRemotoPendente({
                valores: Object.fromEntries(remoto.data.camposEtapa
                  .filter((campo) => Object.hasOwn(snapshotAtivoRef.current.valores, campo.id))
                  .map((campo) => [campo.id, campo.valor ?? ""])),
                versao: new Date(remoto.data.updatedAt).toISOString(),
              });
              setCamposRemotosPendentes(remoto.data.camposEtapa
                .filter((campo) => Object.hasOwn(snapshotAtivoRef.current.valores, campo.id)));
              setConflitoCamposAtuais(true);
              erroDaTentativa = "Este campo foi alterado em outra sessão. Revise o valor antes de salvar.";
            }
          }
        }
      } catch {
        erroDaTentativa = "Falha de conexão ao salvar. A alteração continua no rascunho.";
        return false;
      }
      if (!resultado.success) {
        if (erroDaTentativa === "Não foi possível salvar os campos da etapa.") {
          erroDaTentativa = typeof resultado.error === "string" ? resultado.error
            : resultado.error.formErrors[0] ?? Object.values(resultado.error.fieldErrors).flat()[0]
              ?? erroDaTentativa;
        }
        return false;
      }
      // A action confirma a gravação na própria transação. O fallback mantém
      // compatibilidade com respostas antigas durante uma atualização gradual.
      const confirmacao = resultado.data;
      const cardAtualizado = confirmacao ? null : await ObterCardBpm(card.id);
      if (!confirmacao && (!cardAtualizado?.success || !cardAtualizado.data)) {
        toast.error("Os campos foram salvos, mas não foi possível confirmar a versão atual do card.", erroFormulario);
        return false;
      }
      const novaVersao = new Date(confirmacao?.updatedAt ?? cardAtualizado!.data!.updatedAt).toISOString();
      confirmVersion(card.id, novaVersao);
      const confirmados = confirmacao?.camposValores ?? Object.fromEntries(cardAtualizado!.data!.camposEtapa
        .filter((campo) => Object.hasOwn(camposValores, campo.id))
        .map((campo) => [campo.id, campo.valor ?? ""]));
      Object.assign(confirmados, Object.fromEntries(Object.entries(camposRemotos)
        .filter(([id]) => !Object.hasOwn(confirmados, id))));
      const antesDaConfirmacao = valoresRef.current;
      for (const [id, valor] of Object.entries(confirmados)) {
        const revisao = revisoes.get(id);
        const tipo = camposEtapaBase.find((campo) => campo.id === id)?.tipo ?? "texto";
        const semEdicaoLocal = valoresRef.current[id] === valoresAntesDaRequisicao[id]
          && valorComparavel(tipo, valoresAntesDaRequisicao[id]) === valorComparavel(tipo, baseAntesDaRequisicao[id]);
        const salvoNestaRequisicao = Object.hasOwn(camposValores, id)
          && revisao && rastreadores.current.get(id)?.corresponde(revisao);
        if (salvoNestaRequisicao || semEdicaoLocal) {
          valoresRef.current = { ...valoresRef.current, [id]: valor };
          if (salvoNestaRequisicao) rastreadores.current.get(id)?.sincronizar(valor);
        }
      }
      setValoresCamposAtuais(valoresRef.current);
      setBaseCamposAtuais((atual) => ({ ...atual, ...confirmados }));
      snapshotAtivoRef.current = {
        valores: { ...snapshotAtivoRef.current.valores, ...confirmados },
        versao: novaVersao,
      };
      versaoBaseCamposRef.current = novaVersao;
      setVersaoBaseCampos(novaVersao);
      atualizarPendencias(antesDaConfirmacao);
      if (revisaoEdicao.current === revisaoEnviada) {
        setEstadoSave(possuiValorInvalido ? "invalido" : getDraft(idInstancia) ? "pendente" : "salvo");
      }
      setConflitoCamposAtuais(false);
      onAtualizado();
      return true;
    }, card.id, `${card.id}:campo:${campoId ?? instanceKey}`,
      { ...erroFormulario, failureMessage: () => erroDaTentativa }, false).finally(() => {
      setSavesCamposPendentes((total) => total - 1);
    });
    const sucesso = await promise;
    if (!sucesso && revisaoEdicao.current === revisaoEnviada) setEstadoSave("erro");
    return sucesso;
  }
  function idsPendentes() {
    const atuais = getDraft(idInstancia) ?? valoresRef.current;
    return prepararCamposMotivoLostUiCanonico(card.etapa.chave, camposEtapaBase, atuais).camposVisiveis
      .filter((campo) => !campo.somenteLeitura && campo.editavel !== false
        && !arquivosPendentesRef.current.has(campo.id)
        && valorComparavel(campo.tipo, atuais[campo.id]) !== valorComparavel(campo.tipo, snapshotAtivoRef.current.valores[campo.id]))
      .map((campo) => campo.id);
  }
  async function salvarAlteracoes(): Promise<boolean> {
    if (salvandoManualRef.current) return false;
    const ids = [...new Set([...arquivosPendentesRef.current.keys(), ...idsPendentes()])];
    if (!ids.length) return true;
    salvandoManualRef.current = true;
    setProgressoSave({ concluido: 0, total: ids.length });
    try {
      for (let indice = 0; indice < ids.length; indice += 1) {
        const arquivo = arquivosPendentesRef.current.get(ids[indice]);
        if (arquivo) {
          const key = `${card.id}:arquivo:${ids[indice]}`;
          const sucesso = await registerSave(async () => {
            const confirmado = await arquivo.save();
            if (confirmado) setPendingFields(key, []);
            return confirmado;
          }, card.id, key, erroFormulario);
          if (!sucesso) { setEstadoSave("erro"); return false; }
          arquivosPendentesRef.current.delete(ids[indice]);
          setPendingUpload(key);
          setArquivosPendentes((atual) => { const proximo = { ...atual }; delete proximo[ids[indice]]; return proximo; });
        } else if (!await salvarCamposAtuais(ids[indice])) return false;
        setProgressoSave({ concluido: indice + 1, total: ids.length });
      }
      return idsPendentes().length === 0 && arquivosPendentesRef.current.size === 0;
    } finally {
      salvandoManualRef.current = false;
      setProgressoSave(null);
    }
  }
  const salvarManualRef = useRef(salvarAlteracoes);
  useEffect(() => { salvarManualRef.current = salvarAlteracoes; });
  useEffect(() => registerManualSave(card.id, idInstancia, () => salvarManualRef.current()), [card.id, idInstancia, registerManualSave]);
  const campoCnpj = camposAtuaisVisiveis.find((campo) => campo.chave === FINANCIAL_FIELD_KEYS.CNPJ);
  const camposCorrigidosFinanceiro = new Set(card.camposCorrigidosFinanceiro ?? []);
  const chavesCalculadasFinanceiro = new Set<string>([
    FINANCIAL_FIELD_KEYS.VALOR_IRRF, FINANCIAL_FIELD_KEYS.VALOR_CSRF,
    FINANCIAL_FIELD_KEYS.TOTAL_RETENCOES, FINANCIAL_FIELD_KEYS.VALOR_LIQUIDO,
    FINANCIAL_FIELD_KEYS.MEMORIA_CALCULO, FINANCIAL_FIELD_KEYS.STATUS_FINANCEIRO,
  ]);
  const campoAssinatura = camposAtuaisVisiveis.find((campo) => campo.chave === CHAVES_CAMPOS.STATUS_ASSINATURA);
  const campoDataAssinatura = camposAtuaisVisiveis.find((campo) => campo.chave === CHAVES_CAMPOS.DATA_ASSINATURA);
  const campoContratoAssinado = camposAtuaisVisiveis.find((campo) => campo.chave === CHAVES_CAMPOS.ANEXO_ASSINADO);
  const anexoAssinadoId = campoContratoAssinado ? valoresConfirmados[campoContratoAssinado.id] : null;
  const requisitoContrato = campoAssinatura && avaliarFormalizacaoFinanceira({
    statusAssinatura: valoresConfirmados[campoAssinatura.id],
    dataAssinatura: campoDataAssinatura ? valoresConfirmados[campoDataAssinatura.id] : null,
    anexoAssinadoId,
    anexoAssinadoVinculado: Boolean(anexoAssinadoId && card.anexos.some((anexo) => anexo.id === anexoAssinadoId && anexo.campoId === campoContratoAssinado?.id)),
    pagamentoConfirmado: null,
  }).contrato;
  const cnpjDaEtapa = campoCnpj ? valoresCamposAtuais[campoCnpj.id] ?? "" : "";
  async function consultarCnpjNovoContrato(mostrarErro: boolean) {
    if (!podeEditar || !campoCnpj || buscandoCnpj) return;
    const cnpj = cnpjDaEtapa.replace(/\D/g, "");
    if (cnpj.length !== 14) return;
    cnpjConsultadoRef.current = cnpj;
    setBuscandoCnpj(true);
    const resposta = await ConsultarCnpjNovoContrato(card.id, cnpj);
    setBuscandoCnpj(false);
    if (!resposta.success) {
      if (mostrarErro) toast.error(resposta.error, erroFormulario);
      return;
    }
    const dadosPorChave: Record<string, string> = {
      [FINANCIAL_FIELD_KEYS.RAZAO_SOCIAL]: resposta.data.razaoSocial,
      [FINANCIAL_FIELD_KEYS.RUA]: resposta.data.rua,
      [FINANCIAL_FIELD_KEYS.NUMERO]: resposta.data.numero,
      "alpha.complemento": resposta.data.complemento,
      [FINANCIAL_FIELD_KEYS.BAIRRO]: resposta.data.bairro,
      [FINANCIAL_FIELD_KEYS.CEP]: resposta.data.cep,
      [FINANCIAL_FIELD_KEYS.MUNICIPIO]: resposta.data.municipio,
      [FINANCIAL_FIELD_KEYS.ESTADO]: resposta.data.estado,
    };
    const proximos = { ...valoresRef.current };
    let alterados = 0;
    for (const campo of camposAtuaisVisiveis) {
      const recebido = dadosPorChave[campo.chave ?? ""]?.trim();
      if (!recebido || campo.somenteLeitura || campo.editavel === false || proximos[campo.id]?.trim()) continue;
      proximos[campo.id] = recebido;
      alterados += 1;
    }
    if (!alterados) return;
    revisaoEdicao.current += 1;
    valoresRef.current = proximos;
    setValoresCamposAtuais(proximos);
    setEstadoSave("pendente");
    atualizarPendencias();
  }
  const consultarCnpjRef = useRef(consultarCnpjNovoContrato);
  useEffect(() => { consultarCnpjRef.current = consultarCnpjNovoContrato; });
  useEffect(() => {
    if (card.etapa.chave !== BPM_STAGE_KEYS.SOLICITACAO_CONTRATO || !podeEditar || !campoCnpj) return;
    const cnpj = cnpjDaEtapa.replace(/\D/g, "");
    if (cnpj.length !== 14 || cnpjConsultadoRef.current === cnpj) return;
    const timer = setTimeout(() => { void consultarCnpjRef.current(false); }, 0);
    return () => clearTimeout(timer);
  }, [card.id, card.etapa.chave, podeEditar, campoCnpj, cnpjDaEtapa]);
  const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";
  return (
    <section
      id={`campos-etapa-atual-${idInstancia}`}
      tabIndex={-1}
      className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      aria-labelledby={`campos-etapa-atual-titulo-${idInstancia}`}
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
          <h3 id={`campos-etapa-atual-titulo-${idInstancia}`} className="text-xs font-bold uppercase tracking-wide text-white">{titulo}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{card.etapa.nome} · campos obrigatórios e opcionais.</p>
        </div>
      </div>
      {alertaAlinhamento && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-100">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-300" aria-hidden="true" />
          <p><strong>Chamada de alinhamento pendente.</strong> Cole o resumo da reunião para liberar o avanço da etapa.</p>
        </div>
      )}
      {requisitoContrato && (
        <div role="status" className={requisitoContrato === VALORES.CONCLUIDO
          ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-200"
          : "rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200"}>
          {requisitoContrato === VALORES.CONCLUIDO ? "CONTRATO CONCLUÍDO" : "Contrato pendente de assinatura válida"}
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
          <fieldset className="space-y-3 rounded-xl border border-white/[0.06] p-3">
              {card.etapa.chave === BPM_STAGE_KEYS.SOLICITACAO_CONTRATO && campoCnpj && (
                <button type="button" disabled={!podeEditar || buscandoCnpj || cnpjDaEtapa.replace(/\D/g, "").length !== 14}
                  onClick={() => void consultarCnpjNovoContrato(true)}
                  className="rounded-lg border border-sky-300/25 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:bg-sky-300/10 disabled:opacity-50">
                  {buscandoCnpj ? "Consultando CNPJ..." : "Consultar CNPJ e preencher dados disponíveis"}
                </button>
              )}
              {camposAtuaisVisiveis.map((campo) => {
            const complementoPendente = campo.id === configuracaoLostUi.campoComplementoId && complementoLostPendente;
            const somenteLeitura = campo.somenteLeitura === true || campo.editavel === false;
            const fonteAutomatica = campo.escopo === "GLOBAL" && Boolean(campo.fonteEntidade);
            const origemFinanceiro = card.pipeline?.chave === "financeiro" && card.etapa.chave === "solicitacao_contrato"
              ? chavesCalculadasFinanceiro.has(campo.chave ?? "") ? "Calculado automaticamente"
                : campo.mapeamentoModo === "COPIAR"
                  ? camposCorrigidosFinanceiro.has(campo.id) ? "Corrigido no Financeiro"
                    : (valoresCamposAtuais[campo.id] ?? "").trim() ? "Copiado do Comercial" : "Aguardando dado do Comercial"
                  : null
              : null;
            const descricaoId = complementoPendente ? `campo-bpm-${campo.id}-erro` : undefined;
            return (
              <div key={campo.id} className="space-y-1.5">
                <label htmlFor={`campo-bpm-${campo.id}`} className="text-[11px] font-medium text-slate-400">
                  {campoLabels[campo.id] ?? campo.nome}{campo.obrigatorio ? " *" : ""}{campo.obrigatorioEntrada ? " · exigido na entrada" : ""}{campo.obrigatorioSaida ? " · exigido na saída" : ""}{fonteAutomatica ? " · automático" : ""}
                </label>
                {origemFinanceiro && <p className="text-[10px] text-sky-300/80">{origemFinanceiro}</p>}
                {campo.chave === BPM_FIELD_KEYS.MEETING_SUMMARY && (
                  <button
                    type="button"
                    disabled={!podeEditar || Boolean(valoresCamposAtuais[campo.id]?.trim())}
                    onClick={() => {
                      alterarCampo(campo.id, TEMPLATE_RESUMO_ALINHAMENTO);
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
                    alterarCampo(campo.id, valor);
                  }}
                  className={inputCls}
                  disabled={!podeEditar || progressoSave !== null}
                  readOnly={somenteLeitura}
                  cardId={card.id}
                  arquivoAtual={campo.tipo === "arquivo" || campo.tipo === "url_ou_arquivo"
                    ? card.anexos.find((anexo) => anexo.id === valoresCamposAtuais[campo.id]) ?? null
                    : null}
                  errorToastOptions={erroFormulario}
                  registerFileSave={(save, fileName) => {
                    const key = `${card.id}:arquivo:${campo.id}`;
                    arquivosPendentesRef.current.set(campo.id, { save, nome: fileName });
                    setPendingUpload(key, { save, nome: fileName });
                    setArquivosPendentes((atual) => ({ ...atual, [campo.id]: fileName }));
                    setPendingFields(key, [{
                      label: campoLabels[campo.id] ?? campo.nome,
                      before: card.anexos.find((anexo) => anexo.id === valoresRef.current[campo.id])?.nome ?? "",
                      after: fileName,
                    }]);
                    setEstadoSave("pendente");
                    return Promise.resolve(true);
                  }}
                  onFileConfirmed={(arquivo) => {
                    const antes = { ...valoresRef.current };
                    const proximos = { ...valoresRef.current, [campo.id]: arquivo.id };
                    valoresRef.current = proximos;
                    rastreadores.current.get(campo.id)?.sincronizar(arquivo.id);
                    snapshotAtivoRef.current = {
                      ...snapshotAtivoRef.current,
                      valores: { ...snapshotAtivoRef.current.valores, [campo.id]: arquivo.id },
                    };
                    setValoresCamposAtuais(proximos);
                    setBaseCamposAtuais((atual) => ({ ...atual, [campo.id]: arquivo.id }));
                    atualizarPendencias(antes);
                    onAtualizado();
                  }}
                />
                {arquivosPendentes[campo.id] && <p className="text-[11px] text-amber-200">Arquivo pronto para salvar: {arquivosPendentes[campo.id]}</p>}
                {complementoPendente && (
                  <p id={descricaoId} role="alert" className="text-[11px] text-amber-300">
                    {MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM}
                  </p>
                )}
              </div>
            );
              })}
            </fieldset>
          {podeEditar && (
            <button type="button" onClick={() => void salvarAlteracoes()}
              disabled={totalCamposAlterados === 0 || progressoSave !== null || conflitoCamposAtuais}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/15 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50">
              {progressoSave ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {progressoSave ? `Salvando ${Math.min(progressoSave.concluido + 1, progressoSave.total)}/${progressoSave.total}`
                : `Salvar alterações${totalCamposAlterados ? ` (${totalCamposAlterados})` : ""}`}
            </button>
          )}
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-[11px] text-slate-400">
            {savesCamposPendentes > 0 ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Salvando alterações...</>
              : estadoSave === "salvo" && !conflitoCamposAtuais ? <><Check size={13} aria-hidden="true" /> Salvo</>
              : estadoSave === "erro" ? <><AlertTriangle size={13} aria-hidden="true" /> Erro ao salvar. Sua alteração foi preservada.</>
              : estadoSave === "invalido" ? <><AlertTriangle size={13} aria-hidden="true" /> Revise o campo indicado. As alterações não salvas foram preservadas.</>
              : estadoSave === "pendente" ? "Alterações pendentes" : null}
          </p>
          {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode editar estes campos.</p>}
        </div>
      )}
    </section>
  );
}
