"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { SalvarCadastroEmpresaCardBpm, ConsultarCnpjEdicaoEmpresaCardBpm } from "@/actions/bpm/EmpresaCadastro";
import { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";
import { useCardSave } from "./CardSaveContext";
import { cadastroEmpresaSchema, diferencasCadastroEmpresa, editarValorCadastro, LISTAS_CADASTRO_EMPRESA,
  preencherCadastroComConsulta, SECOES_CADASTRO_EMPRESA, valorCadastro, type CadastroEmpresa } from "@/lib/bpm/dados-empresa-edicao";
import { cnpjEhValido, formatCNPJ, normalizarCNPJ } from "@/lib/format-cnpj";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type DadosEmpresa = NonNullable<Awaited<ReturnType<typeof ObterDadosEmpresaCardBpm>>["data"]>;
export const chaveEditorEmpresa = (cardId: string) => `${cardId}:dados-empresa`;
type Rascunho = { base: DadosEmpresa["edicao"]; cadastro: CadastroEmpresa; tocados?: string[] };

function recuperarRascunho(json: string | undefined, dados: DadosEmpresa): Rascunho {
  if (json) try { const r = JSON.parse(json) as Rascunho; if (r.base.empresaId === dados.edicao.empresaId && r.cadastro?.empresa) return r; } catch { /* Usa a leitura autorizada. */ }
  return { base: dados.edicao, cadastro: structuredClone(dados.edicao.cadastro) };
}

export function DadosEmpresaEditor({ cardId, dados, onSalvo, onCancelar, registrarGuard, onFechar }: {
  cardId: string; dados: DadosEmpresa; onSalvo: (dados: DadosEmpresa) => void; onCancelar: () => void;
  registrarGuard?: (guard: (() => boolean) | null) => void; onFechar: () => void;
}) {
  const { getDraft, setDraft, setPendingFields, registerManualSave, registerSave, clearFailedSave } = useCardSave();
  const chave = chaveEditorEmpresa(cardId);
  const [estado, setEstado] = useState(() => recuperarRascunho(getDraft(chave)?.json, dados));
  const estadoRef = useRef(estado);
  const [salvando, setSalvando] = useState(false); const salvandoRef = useRef(false);
  const [consultando, setConsultando] = useState(false); const consultaRef = useRef(0);
  const cnpjConsultadoRef = useRef(estado.base.cadastro.empresa.cnpj);
  const [erro, setErro] = useState<string | null>(null); const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const ativoRef = useRef(true);
  useEffect(() => { ativoRef.current = true; return () => { ativoRef.current = false; consultaRef.current += 1; }; }, []);

  function atualizar(cadastro: CadastroEmpresa, pathTocado?: string) {
    const novo = { ...estadoRef.current, cadastro,
      tocados: pathTocado ? [...new Set([...(estadoRef.current.tocados ?? []), pathTocado])] : estadoRef.current.tocados };
    estadoRef.current = novo; setEstado(novo);
    const alteracoes = diferencasCadastroEmpresa(novo.base.cadastro, cadastro);
    setDraft(chave, alteracoes.length ? { json: JSON.stringify(novo) } : undefined);
    setPendingFields(chave, alteracoes.map((a) => ({ label: `Dados da empresa · ${a.rotulo}`, before: a.antes ?? "", after: a.depois ?? "" })));
    setErro(null);
  }
  function limpar() { consultaRef.current += 1; setDraft(chave); setPendingFields(chave, []); clearFailedSave(chave); }
  function cancelar() { if (salvandoRef.current) return; limpar(); onCancelar(); }
  const salvarRef = useRef<() => Promise<boolean>>(async () => false);
  async function salvar() {
    if (salvandoRef.current || consultando) return false;
    const atual = estadoRef.current;
    const parsed = cadastroEmpresaSchema.safeParse(atual.cadastro);
    if (!parsed.success) { setErro(parsed.error.issues[0]?.message || "Confira os dados preenchidos."); return false; }
    salvandoRef.current = true; setSalvando(true); setErro(null);
    let mensagemFalha = "Não foi possível salvar os dados. Suas alterações continuam disponíveis para tentar novamente.";
    try {
      return await registerSave(async () => {
        mensagemFalha = "Não foi possível salvar os dados. Suas alterações continuam disponíveis para tentar novamente.";
        let res;
        try { res = await SalvarCadastroEmpresaCardBpm({ cardId, ...atual.base, cadastro: parsed.data }); }
        catch { if (ativoRef.current) setErro(mensagemFalha); return false; }
        if (!res.success) { mensagemFalha = res.error; if (ativoRef.current) setErro(res.error); return false; }
        limpar();
        if (ativoRef.current) onSalvo(res.data);
        return true;
      }, cardId, chave, { failureMessage: () => mensagemFalha });
    } finally { salvandoRef.current = false; if (ativoRef.current) setSalvando(false); }
  }
  useEffect(() => { salvarRef.current = salvar; });
  useEffect(() => registerManualSave(cardId, chave, () => salvarRef.current()), [cardId, chave, registerManualSave]);
  useEffect(() => {
    registrarGuard?.(() => {
      if (salvandoRef.current) return false;
      if (getDraft(chave)) { setConfirmarSaida(true); return false; }
      return true;
    });
    return () => registrarGuard?.(null);
  }, [registrarGuard, getDraft, chave]);

  async function consultar() {
    const cnpj = normalizarCNPJ(estadoRef.current.cadastro.empresa.cnpj);
    if (!cnpjEhValido(cnpj) || salvandoRef.current || consultando) return;
    const consulta = ++consultaRef.current; setConsultando(true); setErro(null); setAviso(null);
    try {
      const res = await ConsultarCnpjEdicaoEmpresaCardBpm({ cardId, cnpj });
      if (!ativoRef.current || consulta !== consultaRef.current || normalizarCNPJ(estadoRef.current.cadastro.empresa.cnpj) !== cnpj) return;
      if (!res.success) { setErro(res.error); return; }
      const mudouCnpj = cnpjConsultadoRef.current && normalizarCNPJ(cnpjConsultadoRef.current) !== cnpj;
      atualizar(preencherCadastroComConsulta(estadoRef.current.cadastro, res.cadastro, res.fontes, cnpjConsultadoRef.current, estadoRef.current.tocados));
      cnpjConsultadoRef.current = cnpj;
      setAviso((mudouCnpj ? "O CNPJ mudou. Revise os dados anteriores que não puderam ser consultados. " : "")
        + (res.falhas.length ? `Consulta parcial: ${res.falhas.join(", ")} indisponível. Campos sem retorno e edições manuais foram preservados.` : "Consulta concluída. Confira os dados e clique em Salvar."));
    } catch { if (ativoRef.current && consulta === consultaRef.current) setErro("Não foi possível consultar agora. Seus dados foram preservados."); }
    finally { if (ativoRef.current && consulta === consultaRef.current) setConsultando(false); }
  }

  const inputClass = "mt-1.5 min-w-0 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-violet-300 focus:outline-none disabled:opacity-60";
  function campo(path: string, label: string, tipo?: string) {
    const value = valorCadastro(estado.cadastro, path);
    const options = tipo === "booleano" ? ["", "true", "false"] : tipo === "contato" ? ["Telefone", "E-mail"] : tipo === "cnae" ? ["Principal", "Secundário"] : null;
    return <label key={path} className={`block min-w-0 text-xs font-medium text-slate-300 ${path === "empresa.cnpj" ? "sm:col-span-2" : ""}`}>{label}
      {options ? <select aria-label={label} value={value === null ? "" : String(value)} className={inputClass}
        onChange={(e) => atualizar(editarValorCadastro(estadoRef.current.cadastro, path, tipo === "booleano" ? e.target.value ? e.target.value === "true" : null : e.target.value), path)}>
        {options.map((v) => <option key={v} value={v}>{tipo === "booleano" ? v === "true" ? "Sim" : v === "false" ? "Não" : "Não informado" : v}</option>)}
      </select> : <div className="flex items-end gap-2">
        <input aria-label={label} className={inputClass} type={tipo === "numero" ? "number" : "text"} step={tipo === "numero" ? "0.01" : undefined} min={tipo === "numero" ? 0 : undefined}
          maxLength={tipo === "numero" ? undefined : 2000} value={value === null || value === undefined ? "" : path === "empresa.cnpj" ? formatCNPJ(String(value)) || String(value) : String(value)}
          onChange={(e) => atualizar(editarValorCadastro(estadoRef.current.cadastro, path, tipo === "numero" ? e.target.value === "" ? null : Number(e.target.value) : path === "empresa.cnpj" ? normalizarCNPJ(e.target.value) : e.target.value || null), path)} />
        {path === "empresa.cnpj" && normalizarCNPJ(String(value ?? "")).length === 14 && <button type="button" onClick={() => void consultar()} disabled={consultando || !cnpjEhValido(String(value))}
          title="Consultar CNPJ" aria-label="Consultar CNPJ" className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-violet-500 px-3 text-xs font-bold text-white disabled:opacity-40">
          {consultando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Consultar</button>}
      </div>}
    </label>;
  }
  return <div className="relative" aria-label="Edição dos dados da empresa">
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-violet-300/20 bg-[var(--crm-painel-elevado,#1b2130)] p-3">
      <strong className="text-xs text-violet-200">Editando dados da empresa</strong>
      <div className="flex gap-2"><button type="button" aria-busy={salvando} disabled={salvando || consultando} onClick={() => void salvar()}
        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{salvando ? "Salvando…" : "Salvar"}</button>
        <button type="button" disabled={salvando} onClick={cancelar} className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-50"><X size={14} />Cancelar</button></div>
    </div>
    <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="space-y-4 p-3">
      {erro && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-200">{erro}</p>}
      {aviso && <p role="status" className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-xs text-sky-200">{aviso}</p>}
      <fieldset disabled={salvando || consultando} className="min-w-0 space-y-4">
        {SECOES_CADASTRO_EMPRESA.map((secao) => <section key={secao.titulo} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <h3 className="mb-4 text-sm font-bold text-white">{secao.titulo}</h3>
          <div className="grid gap-3 sm:grid-cols-2">{secao.campos.map((c) => campo(c[0], c[1], c.length > 2 ? c[2] : undefined))}</div>
        </section>)}
        {LISTAS_CADASTRO_EMPRESA.map((lista) => {
          const itens = valorCadastro(estado.cadastro, lista.path) as unknown[];
          return <section key={lista.path} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="mb-3 text-sm font-bold text-white">{lista.titulo}</h3>
            <div className="space-y-3">{itens.map((_, i) => <div key={i} className="space-y-2 rounded-xl border border-white/10 p-3">
              <div className="grid gap-3 sm:grid-cols-2">{lista.campos.map((c) => campo(`${lista.path}.${i}.${c[0]}`, `${c[1]} · ${lista.titulo} ${i + 1}`, c.length > 2 ? c[2] : undefined))}</div>
              <button type="button" onClick={() => atualizar(editarValorCadastro(estadoRef.current.cadastro, lista.path, itens.filter((_, n) => n !== i)), lista.path)} className="flex items-center gap-1 text-xs text-rose-300"><Trash2 size={12} />Remover {i + 1}</button>
            </div>)}</div>
            <button type="button" onClick={() => atualizar(editarValorCadastro(estadoRef.current.cadastro, lista.path, [...itens, { ...lista.novo }]), lista.path)} className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200"><Plus size={13} />Adicionar</button>
          </section>;
        })}
      </fieldset>
    </form>
    <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Dados da empresa não salvos</AlertDialogTitle><AlertDialogDescription>Salve as alterações ou descarte a edição antes de fechar os dados da empresa.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={salvando}>Continuar editando</AlertDialogCancel>
        <button type="button" aria-busy={salvando} disabled={salvando || consultando} onClick={async () => { if (await salvarRef.current()) onFechar(); }} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white">
          {salvando && <Loader2 size={14} className="animate-spin" />}{salvando ? "Salvando…" : "Salvar alterações"}</button>
        <button type="button" disabled={salvando} onClick={() => { limpar(); onFechar(); }} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white">Descartar alterações</button>
      </AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
