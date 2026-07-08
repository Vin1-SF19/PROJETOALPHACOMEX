"use client";

import { useState } from "react";
import { Loader2, Search, User, ChevronDown, X, Plus, CheckCircle2 } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao, type RepresentanteExtra } from "./shared";

function formatarCpf(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

const respCompleto = (r: RepresentanteExtra) =>
  r.nome.trim().length >= 2 && r.cpf.replace(/\D/g, "").length === 11 && !!r.dataNascimento;

interface Props {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  sobre: string;
  souRepresentante: boolean;
  representantesExtra: RepresentanteExtra[];
  onChange: (patch: {
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    dadosConsultaCnpj?: string;
    sobre?: string;
    souRepresentante?: boolean;
    representantesExtra?: RepresentanteExtra[];
  }) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepEmpresa({
  cnpj, razaoSocial, nomeFantasia, sobre, souRepresentante, representantesExtra, onChange, onBack, onNext,
}: Props) {
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [respAbertoIdx, setRespAbertoIdx] = useState<number>(representantesExtra.length > 0 ? -1 : 0);
  const [tentouAvancar, setTentouAvancar] = useState(false);

  async function buscarCnpj() {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setErroBusca("Informe um CNPJ válido (14 dígitos)");
      return;
    }
    setErroBusca(null);
    setBuscando(true);
    try {
      const r = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
      const d = await r.json();
      if (!r.ok || d.error) {
        setErroBusca(d.error || "Não foi possível buscar os dados do CNPJ");
        return;
      }
      onChange({
        razaoSocial: d.razaoSocial || razaoSocial,
        nomeFantasia: d.nomeFantasia || nomeFantasia,
        dadosConsultaCnpj: JSON.stringify(d),
      });
    } catch {
      setErroBusca("Erro ao buscar CNPJ. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  }

  const respVazio = (): RepresentanteExtra => ({ nome: "", cpf: "", dataNascimento: "", cargo: "", telefone: "" });
  const updateResp = (i: number, campo: keyof RepresentanteExtra, valor: string) =>
    onChange({ representantesExtra: representantesExtra.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)) });
  const addResp = () => {
    onChange({ representantesExtra: [...representantesExtra, respVazio()] });
    setRespAbertoIdx(representantesExtra.length);
  };
  const removeResp = (i: number) => {
    onChange({ representantesExtra: representantesExtra.filter((_, idx) => idx !== i) });
    setRespAbertoIdx(-1);
  };

  const representantesValidos = representantesExtra.filter(respCompleto);
  const precisaRepresentante = !souRepresentante;
  const representanteOk = !precisaRepresentante || representantesValidos.length > 0;

  function handleContinuar() {
    setTentouAvancar(true);
    if (representanteOk) onNext();
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Dados da sua empresa</h2>

        <Campo label="CNPJ da sua empresa" dica="Opcional. Preencha e use a lupa para buscar os dados automaticamente.">
          <div className="flex gap-2">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => onChange({ cnpj: e.target.value })}
              className={inputCls}
              placeholder="00.000.000/0000-00"
            />
            <button
              type="button"
              onClick={buscarCnpj}
              disabled={buscando}
              className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
          {erroBusca && <p className="text-[11px] text-rose-400 mt-1">{erroBusca}</p>}
        </Campo>

        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Razão Social" dica="Preenchido automaticamente pela busca de CNPJ.">
            <input
              type="text"
              value={razaoSocial}
              onChange={(e) => onChange({ razaoSocial: e.target.value })}
              className={inputCls}
            />
          </Campo>
          <Campo label="Nome Fantasia">
            <input
              type="text"
              value={nomeFantasia}
              onChange={(e) => onChange({ nomeFantasia: e.target.value })}
              className={inputCls}
            />
          </Campo>
        </div>

        <Campo
          label="Gostaria de falar mais sobre você e sua empresa?"
          dica="Use esse espaço para falar mais sobre você e sobre sua empresa, gostamos de conhecer bem os nossos parceiros."
        >
          <textarea value={sobre} onChange={(e) => onChange({ sobre: e.target.value })} rows={4} className={`${inputCls} resize-none py-2.5`} />
        </Campo>
      </CardSecao>

      <CardSecao>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={souRepresentante}
            onChange={(e) => onChange({ souRepresentante: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-blue-500"
          />
          <span className="text-[12px] text-slate-300">
            Eu sou o representante da empresa <span className="text-rose-400">*</span>
          </span>
        </label>
        <p className="text-[10.5px] text-slate-500 -mt-1">
          Se desmarcado, informe abaixo quem são o(s) representante(s) legais da empresa.
        </p>

        {!souRepresentante && (
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">
              Representante(s) da empresa <span className="text-slate-600">(ao menos um obrigatório)</span>
            </p>

            {representantesExtra.map((r, i) => {
              const aberto = respAbertoIdx === i;
              const completo = respCompleto(r);
              return (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button type="button" onClick={() => setRespAbertoIdx(aberto ? -1 : i)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                      <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: completo ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)" }}>
                        <User size={13} className={completo ? "text-emerald-400" : "text-amber-400"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-200 truncate">{r.nome || `Representante ${i + 1}`}</p>
                        {completo && <p className="text-[10px] text-slate-500 truncate font-mono">{r.cpf}{r.cargo ? ` · ${r.cargo}` : ""}</p>}
                      </div>
                      <ChevronDown size={15} className={`shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180" : ""}`} />
                    </button>
                    {representantesExtra.length > 1 && (
                      <button type="button" onClick={() => removeResp(i)} title="Remover" className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {aberto && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
                      <Campo label="Nome Completo" obrigatorio>
                        <input value={r.nome} onChange={(e) => updateResp(i, "nome", e.target.value)} className={inputCls} />
                      </Campo>
                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="CPF" obrigatorio>
                          <input value={r.cpf} onChange={(e) => updateResp(i, "cpf", formatarCpf(e.target.value))} placeholder="000.000.000-00" className={`${inputCls} font-mono`} />
                        </Campo>
                        <Campo label="Data Nasc." obrigatorio>
                          <input type="date" value={r.dataNascimento} onChange={(e) => updateResp(i, "dataNascimento", e.target.value)} className={inputCls} />
                        </Campo>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="Cargo / Relação">
                          <input value={r.cargo} onChange={(e) => updateResp(i, "cargo", e.target.value)} placeholder="Sócio, Diretor, Procurador..." className={inputCls} />
                        </Campo>
                        <Campo label="WhatsApp">
                          <input value={r.telefone} onChange={(e) => updateResp(i, "telefone", e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                        </Campo>
                      </div>
                      <button
                        type="button"
                        disabled={!completo}
                        onClick={() => setRespAbertoIdx(-1)}
                        className="w-full h-10 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-black uppercase text-[11px] tracking-widest gap-2 disabled:opacity-30 flex items-center justify-center"
                      >
                        <CheckCircle2 size={14} /> Salvar representante
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addResp}
              className="w-full h-11 rounded-xl border border-dashed border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-black uppercase text-[11px] tracking-widest gap-2 flex items-center justify-center"
            >
              <Plus size={14} /> Adicionar representante
            </button>

            {tentouAvancar && !representanteOk && (
              <p className="text-[11px] text-rose-400">Adicione ao menos um representante com nome, CPF e data de nascimento válidos.</p>
            )}
          </div>
        )}
      </CardSecao>

      <BotoesNavegacao onBack={onBack} onNext={handleContinuar} />
    </div>
  );
}
