"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Video, CalendarClock, FileText, RefreshCw, CircleCheck, Download } from "lucide-react";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { AgendarReuniaoGoogleMeetBpm, ListarConvidadosReuniaoGoogleMeetBpm, ReagendarReuniaoBpm } from "@/actions/bpm/GoogleMeet";
import {
  SalvarResumoReuniaoBpm,
  SincronizarTranscricaoReuniaoBpm,
  ObterArtefatosMeetBpm,
} from "@/actions/bpm/TranscricaoMeet";
import { useCardSave } from "./CardSaveContext";
import { BpmDateTimeField } from "./BpmDateTimeField";
import { fmtDateTime, formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";
import { criarRastreadorRascunho } from "@/lib/bpm/rascunho-versionado";
import { emailClienteReuniaoSchema, emailsConvidadosReuniaoSchema } from "@/lib/bpm/email-reuniao";
import { transcricaoRealRegistrada } from "@/lib/bpm/reuniao-agendada";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  onAtualizado: () => void;
  /** Na etapa Reunião Agendada, exibe reagendamento e transcrição. */
  mostrarFormulario?: boolean;
  permitirReagendar?: boolean;
}

export function PainelReuniao({ card, accent, podeEditar, onAtualizado, mostrarFormulario = true, permitirReagendar = false }: Props) {
  const { registerSave, scheduleSave, getVersion, confirmVersion, getDraft, setDraft, setPendingFields } = useCardSave();
  const [dataHora, setDataHora] = useState(() => formatarDataHoraLocalBpm(card.dataReuniao));
  const [erroDataHora, setErroDataHora] = useState<string | null>(null);
  const [emailCliente, setEmailCliente] = useState(card.emailClienteReuniao ?? "");
  const [emailsAdicionados, setEmailsAdicionados] = useState<string[]>([]);
  const [erroEmailCliente, setErroEmailCliente] = useState<string | null>(null);
  const draftKey = `${card.id}:resumo`;
  const [resumo, setResumo] = useState(() => getDraft(draftKey)?.valor ?? card.transcricaoReuniao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvandoResumo, setSalvandoResumo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erroTranscricao, setErroTranscricao] = useState<string | null>(null);
  const [motivoPendente, setMotivoPendente] = useState<string | null>(null);
  const [resumosMeet, setResumosMeet] = useState<Array<{ nome: string; url: string }>>([]);
  const [gravacoesMeet, setGravacoesMeet] = useState<Array<{ nome: string; url: string }>>([]);
  const [buscandoResumos, setBuscandoResumos] = useState(false);
  const [gerandoFicha, setGerandoFicha] = useState(false);
  const [erroResumos, setErroResumos] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [conflitoDataHora, setConflitoDataHora] = useState(false);
  const [conflitoResumo, setConflitoResumo] = useState(false);
  const cardIdRef = useRef(card.id);
  const dataHoraSujaRef = useRef(false);
  const emailClienteSujoRef = useRef(false);
  const resumoSujoRef = useRef(Boolean(getDraft(draftKey)));
  const dataHoraPersistidaRef = useRef(formatarDataHoraLocalBpm(card.dataReuniao));
  const resumoPersistidoRef = useRef(card.transcricaoReuniao ?? "");
  const dataHoraRascunhoRef = useRef(criarRastreadorRascunho(formatarDataHoraLocalBpm(card.dataReuniao)));
  const resumoRascunhoRef = useRef(criarRastreadorRascunho(resumo));

  const jaAgendada = Boolean(card.googleEventId);
  const transcricaoRecebida = transcricaoRealRegistrada(card.transcricaoReuniao);
  const reuniaoJaOcorreu = Boolean(card.dataReuniao && new Date(card.dataReuniao).getTime() <= agora);
  const reagendamentoBloqueado = jaAgendada && (transcricaoRecebida || reuniaoJaOcorreu);

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const novaDataHora = formatarDataHoraLocalBpm(card.dataReuniao);
    const novoEmailCliente = card.emailClienteReuniao ?? "";
    const novoResumo = card.transcricaoReuniao ?? "";

    if (cardIdRef.current !== card.id) {
      cardIdRef.current = card.id;
      dataHoraSujaRef.current = false;
      emailClienteSujoRef.current = false;
      resumoSujoRef.current = false;
      dataHoraPersistidaRef.current = novaDataHora;
      resumoPersistidoRef.current = novoResumo;
      dataHoraRascunhoRef.current = criarRastreadorRascunho(novaDataHora);
      resumoRascunhoRef.current = criarRastreadorRascunho(novoResumo);
      setDataHora(novaDataHora);
      setEmailCliente(novoEmailCliente);
      setEmailsAdicionados([]);
      setResumosMeet([]);
      setGravacoesMeet([]);
      setErroResumos(null);
      setErroEmailCliente(null);
      setResumo(novoResumo);
      setConflitoDataHora(false);
      setConflitoResumo(false);
      return;
    }

    if (!emailClienteSujoRef.current) {
      setEmailCliente(novoEmailCliente);
      setErroEmailCliente(null);
    }

    if (dataHoraSujaRef.current) {
      if (novaDataHora !== dataHoraPersistidaRef.current) setConflitoDataHora(true);
    } else {
      dataHoraPersistidaRef.current = novaDataHora;
      dataHoraRascunhoRef.current.sincronizar(novaDataHora);
      setDataHora(novaDataHora);
      setConflitoDataHora(false);
    }

    if (!getDraft(draftKey)) resumoSujoRef.current = false;
    if (resumoSujoRef.current) {
      if (novoResumo !== resumoPersistidoRef.current) setConflitoResumo(true);
    } else {
      resumoPersistidoRef.current = novoResumo;
      resumoRascunhoRef.current.sincronizar(novoResumo);
      setResumo(novoResumo);
      setConflitoResumo(false);
    }
  }, [card.id, card.dataReuniao, card.emailClienteReuniao, card.transcricaoReuniao, draftKey, getDraft]);

  useEffect(() => {
    if (!card.googleEventId) return;
    let ativo = true;
    void ListarConvidadosReuniaoGoogleMeetBpm(card.id).then((resultado) => {
      if (!ativo || !resultado.success || emailClienteSujoRef.current) return;
      const principal = emailClienteReuniaoSchema.safeParse(card.emailClienteReuniao);
      const emails = Array.from(new Set([
        ...(principal.success ? [principal.data] : []),
        ...resultado.data,
      ]));
      if (emails.length > 0) {
        setEmailsAdicionados(emails);
        setEmailCliente("");
      }
    }).catch(() => { /* Falha de leitura não impede reagendar com o e-mail principal. */ });
    return () => { ativo = false; };
  }, [card.id, card.googleEventId, card.emailClienteReuniao]);

  useEffect(() => {
    if (mostrarFormulario || !card.googleEventId || !card.dataReuniao || new Date(card.dataReuniao).getTime() > Date.now()) return;
    let ativo = true;
    void ObterArtefatosMeetBpm({ cardId: card.id }).then((resultado) => {
      if (!ativo) return;
      if (resultado.success) {
        setResumosMeet(resultado.data.resumos);
        setGravacoesMeet(resultado.data.gravacoes);
      }
      else setErroResumos(resultado.error);
    });
    return () => { ativo = false; };
  }, [card.id, card.googleEventId, card.dataReuniao, mostrarFormulario]);

  function adicionarEmailDigitado() {
    const resultado = emailClienteReuniaoSchema.safeParse(emailCliente);
    if (!resultado.success) {
      setErroEmailCliente(resultado.error.issues[0]?.message ?? "Informe um e-mail válido.");
      return;
    }
    if (emailsAdicionados.length >= 50 && !emailsAdicionados.includes(resultado.data)) {
      setErroEmailCliente("Adicione no máximo 50 convidados.");
      return;
    }
    emailClienteSujoRef.current = true;
    setEmailsAdicionados((atuais) => atuais.includes(resultado.data) ? atuais : [...atuais, resultado.data]);
    setEmailCliente("");
    setErroEmailCliente(null);
  }

  async function handleAgendar() {
    if (salvando || !podeEditar) return;
    const dataPersistida = parseDataHoraLocalBpm(dataHora);
    if (!dataPersistida) {
      setErroDataHora("Escolha uma data e uma hora válidas.");
      toast.error("Escolha data e hora da reunião");
      return;
    }
    const emailsValidados = emailsConvidadosReuniaoSchema.safeParse([
      ...emailsAdicionados,
      ...(emailCliente.trim() ? [emailCliente] : []),
    ]);
    if (!emailsValidados.success) {
      const mensagem = emailsValidados.error.issues[0]?.message ?? "Informe um e-mail válido.";
      setErroEmailCliente(mensagem);
      toast.error(mensagem);
      return;
    }
    setErroDataHora(null);
    setErroEmailCliente(null);
    const [emailPrincipal, ...emailsAdicionais] = emailsValidados.data;
    const snapshotDataHora = dataHoraRascunhoRef.current.capturar();
    setSalvando(true);
    const dados = {
      cardId: card.id,
      dataHora: dataPersistida.toISOString(),
      emailCliente: emailPrincipal,
      emailsAdicionais,
    };
    const res = jaAgendada
      ? await ReagendarReuniaoBpm(dados)
      : await AgendarReuniaoGoogleMeetBpm(dados);
    setSalvando(false);

    if (res.success) {
      emailClienteSujoRef.current = true;
      setEmailsAdicionados(emailsValidados.data);
      setEmailCliente("");
      dataHoraPersistidaRef.current = snapshotDataHora.valor;
      if (dataHoraRascunhoRef.current.corresponde(snapshotDataHora)) {
        dataHoraSujaRef.current = false;
        setConflitoDataHora(false);
      }
      toast.success(jaAgendada ? "Reunião reagendada" : "Reunião agendada no Google Meet");
      if (!jaAgendada && "data" in res && res.data && typeof res.data === "object"
        && "avancoConcluido" in res.data && !res.data.avancoConcluido) {
        toast.info("Reunião criada; a mudança para Reunião Agendada está pendente.");
      }
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Não foi possível salvar a reunião");
    }
  }

  async function handleSincronizarTranscricao() {
    setSincronizando(true);
    setErroTranscricao(null);
    setMotivoPendente(null);
    const res = await SincronizarTranscricaoReuniaoBpm({ cardId: card.id });
    setSincronizando(false);
    if (!res.success) {
      setErroTranscricao(res.error);
      toast.error(res.error);
      return;
    }
    if (res.data.status === "PENDENTE") {
      setMotivoPendente(res.data.motivo);
      toast.info(res.data.motivo);
      return;
    }
    toast.success(res.data.atualizada ? "Transcrição recebida" : "Transcrição já estava atualizada");
    onAtualizado();
  }

  async function handleBuscarResumos() {
    setBuscandoResumos(true);
    setErroResumos(null);
    const resultado = await ObterArtefatosMeetBpm({ cardId: card.id });
    setBuscandoResumos(false);
    if (resultado.success) {
      setResumosMeet(resultado.data.resumos);
      setGravacoesMeet(resultado.data.gravacoes);
    }
    else setErroResumos(resultado.error);
  }

  async function handleGerarFicha() {
    setGerandoFicha(true);
    const { GerarFichaViabilidadeBpm } = await import("@/actions/bpm/FichaViabilidade");
    const resultado = await GerarFichaViabilidadeBpm({ cardId: card.id });
    setGerandoFicha(false);
    if (!resultado.success) { toast.error(resultado.error); return; }
    const bytes = Uint8Array.from(atob(resultado.data.base64), (caractere) => caractere.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = resultado.data.nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function persistirResumo(): Promise<boolean> {
    const snapshot = resumoRascunhoRef.current.capturar();
    return registerSave(async () => {
      setSalvandoResumo(true);
      const resultado = await SalvarResumoReuniaoBpm({
        cardId: card.id,
        resumo: snapshot.valor,
        versaoEsperadaEm: getVersion(card.id, new Date(card.updatedAt).toISOString()),
      });
      setSalvandoResumo(false);
      if (!resultado.success) {
        toast.error(resultado.error);
        return false;
      }
      if (resultado.data) confirmVersion(card.id, new Date(resultado.data.updatedAt).toISOString());
      resumoPersistidoRef.current = snapshot.valor;
      if (getDraft(draftKey)?.valor === snapshot.valor) setDraft(draftKey);
      const rascunhoAtual = getDraft(draftKey)?.valor;
      setPendingFields(draftKey, rascunhoAtual !== undefined && rascunhoAtual !== snapshot.valor
        ? [{ label: "Transcrição da reunião", before: snapshot.valor, after: rascunhoAtual }] : []);
      if (resumoRascunhoRef.current.corresponde(snapshot)) {
        resumoSujoRef.current = false;
        setConflitoResumo(false);
      }
      toast.success("Transcrição da reunião salva");
      onAtualizado();
      return true;
    }, card.id, draftKey, undefined, false);
  }

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarClock size={13} className="text-slate-500" />
        Reunião
      </div>

      {!mostrarFormulario && card.dataReuniao && (
        <p className="text-[11px] text-slate-400">
          Data da reunião:{" "}
          <time dateTime={new Date(card.dataReuniao).toISOString()} className="font-medium text-slate-300">
            {fmtDateTime(card.dataReuniao)}
          </time>
        </p>
      )}

      {(mostrarFormulario || (permitirReagendar && jaAgendada)) && (
        <>
          <BpmDateTimeField
            id={`reuniao-data-hora-${card.id}`}
            label="Data e hora da reunião"
            value={dataHora}
            onChange={(novoValor) => {
              dataHoraSujaRef.current = true;
              dataHoraRascunhoRef.current.alterar(novoValor);
              setDataHora(novoValor);
              setErroDataHora(null);
            }}
            required
            disabled={!podeEditar || salvando || reagendamentoBloqueado}
            error={erroDataHora}
          />

          <div className="space-y-1.5">
            <label htmlFor={`reuniao-email-cliente-${card.id}`} className="text-[10px] font-medium text-slate-400">
              E-mails dos convidados
            </label>
            {emailsAdicionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Convidados adicionados">
                {emailsAdicionados.map((email, index) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100">
                    {index === 0 && <span className="font-semibold">Principal:</span>}
                    {email}
                    <button type="button" aria-label={`Remover ${email}`} disabled={!podeEditar || salvando || reagendamentoBloqueado} onClick={() => {
                      emailClienteSujoRef.current = true;
                      setEmailsAdicionados((atuais) => atuais.filter((item) => item !== email));
                    }} className="rounded px-1 hover:bg-white/10 disabled:opacity-50">×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              id={`reuniao-email-cliente-${card.id}`}
              name="emailCliente"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={emailCliente}
              onChange={(event) => {
                const novoValor = event.target.value;
                emailClienteSujoRef.current = true;
                setEmailCliente(novoValor);
                setErroEmailCliente(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  adicionarEmailDigitado();
                }
              }}
              required={emailsAdicionados.length === 0}
              disabled={!podeEditar || salvando || reagendamentoBloqueado}
              aria-invalid={Boolean(erroEmailCliente)}
              aria-describedby={erroEmailCliente ? `reuniao-email-cliente-erro-${card.id}` : undefined}
              placeholder="Digite o e-mail e pressione Enter"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-rose-400/60"
            />
            <p className="text-[10px] text-slate-500">Pressione Enter para adicionar outro convidado. O primeiro e-mail será o contato principal da reunião.</p>
            {erroEmailCliente && (
              <p id={`reuniao-email-cliente-erro-${card.id}`} className="text-[10px] text-rose-300" role="alert">
                {erroEmailCliente}
              </p>
            )}
          </div>

          {conflitoDataHora && (
            <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200" role="status">
              A data da reunião mudou externamente. Seu rascunho foi preservado.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleAgendar()}
            disabled={!podeEditar || salvando || reagendamentoBloqueado}
            title={reagendamentoBloqueado
              ? "O horário da reunião já passou ou há transcrição. Preserve o evento para receber a evidência."
              : undefined}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-60"
            style={{ background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},0.35)` }}
          >
            {salvando ? <RefreshCw size={13} className="animate-spin" /> : <Video size={13} />}
            {salvando
              ? "Salvando..."
              : reagendamentoBloqueado
                ? "Reunião concluída"
                : jaAgendada
                  ? "Reagendar"
                  : "Agendar pelo Google Meet"}
          </button>

          {card.googleMeetLink && (
            <a
              href={card.googleMeetLink}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-[11px] text-slate-400 hover:text-slate-300 underline underline-offset-2"
            >
              Abrir link da reunião
            </a>
          )}
        </>
      )}

      {!jaAgendada && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200" role="status">
          Nenhuma reunião vinculada a este card
        </p>
      )}

      {!mostrarFormulario && jaAgendada && (
        <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3 space-y-2">
          <button type="button" onClick={() => void handleGerarFicha()} disabled={gerandoFicha}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
            <Download size={13} /> {gerandoFicha ? "Gerando ficha…" : "Gerar ficha de viabilidade"}
          </button>
          <div className="space-y-2">
            <button type="button" onClick={() => void handleBuscarResumos()} disabled={buscandoResumos}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
              {buscandoResumos ? "Buscando artefatos…" : "Buscar resumos e gravações do Google Meet"}
            </button>
            {erroResumos && <p role="alert" className="text-xs text-rose-300">{erroResumos}</p>}
            {resumosMeet.length > 0 ? resumosMeet.map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer"
                className="block text-xs text-cyan-300 underline">{item.nome} no Google Docs</a>
            )) : !buscandoResumos && !erroResumos && <p className="text-xs text-slate-500">Os resumos aparecem aqui quando o Meet gerar notas com o Gemini.</p>}
            {gravacoesMeet.map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer"
                className="block text-xs text-cyan-300 underline">{item.nome} no Google Drive</a>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            {transcricaoRecebida ? (
              <>
                <CircleCheck size={14} className="text-emerald-400" />
                <span className="text-emerald-300">Transcrição recebida</span>
              </>
            ) : (
              <>
                <FileText size={14} className="text-amber-400" />
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-amber-200" role="status">
                  Transcrição ainda não disponível — tente novamente em alguns minutos
                </span>
              </>
            )}
          </div>

          <div className="space-y-1.5">
              <label htmlFor={`resumo-reuniao-${card.id}`} className="text-[10px] font-medium text-slate-400">
                Transcrição da reunião
              </label>
              <textarea
                id={`resumo-reuniao-${card.id}`}
                value={resumo}
                placeholder="Cole a transcrição da reunião ou busque o texto gerado pelo Google Meet abaixo."
                onChange={(event) => {
                  resumoSujoRef.current = true;
                  resumoRascunhoRef.current.alterar(event.target.value);
                  setResumo(event.target.value);
                  setDraft(draftKey, { valor: event.target.value });
                  setPendingFields(draftKey, event.target.value !== resumoPersistidoRef.current
                    ? [{ label: "Transcrição da reunião", before: resumoPersistidoRef.current, after: event.target.value }] : []);
                  scheduleSave(`${card.id}:resumo`, () => void persistirResumo());
                }}
                onBlur={() => void persistirResumo()}
                disabled={!podeEditar}
                aria-label="Transcrição da reunião"
                className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-slate-300 outline-none transition-colors focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-500" role="status" aria-live="polite">
                {salvandoResumo ? "Salvando resumo…" : resumo.trim()
                  ? "A transcrição está registrada e pode ser revisada antes de avançar."
                  : "O Google pode levar alguns minutos após a reunião. Você também pode colar a transcrição aqui."}
              </p>
              {conflitoResumo && (
                <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200" role="status">
                  O resumo mudou externamente. Seu rascunho foi preservado.
                </p>
              )}
          </div>

          {motivoPendente && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-amber-200" role="status">
              Transcrição ainda não disponível — tente novamente em alguns minutos. {motivoPendente}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSincronizarTranscricao()}
            disabled={sincronizando || !podeEditar}
            aria-label={transcricaoRecebida ? "Atualizar transcrição" : "Buscar transcrição"}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw size={12} className={sincronizando ? "animate-spin" : ""} />
            {sincronizando
              ? "Buscando transcrição…"
              : transcricaoRecebida
                ? "Atualizar transcrição"
                : "Buscar transcrição"}
          </button>

          {erroTranscricao && (
            <p className="text-[10px] leading-relaxed text-rose-300">Erro ao sincronizar: {erroTranscricao}</p>
          )}
        </div>
      )}
    </div>
  );
}
