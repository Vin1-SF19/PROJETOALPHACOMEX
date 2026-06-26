"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { submeterConvitePublico } from "@/actions/convites-parceiro";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const AREAS = [
  "Despacho Aduaneiro", "Agenciamento de Cargas", "Contabilidade", "Advocacia",
  "Consultoria Empresarial", "Trade", "Digital Influencer", "Outros",
];

interface Props {
  token: string;
  termo: { versao: string; conteudo: string } | null;
}

export default function FormConviteParceiro({ token, termo }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [sobre, setSobre] = useState("");
  const [aceito, setAceito] = useState(false);

  const toggleArea = (a: string) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await submeterConvitePublico({
        token, email, nomeCompleto,
        cpf: cpf || undefined,
        uf, municipio: municipio || undefined,
        telefone,
        areasAtuacao: areas.length > 0 ? areas : undefined,
        nomeEmpresa: nomeEmpresa || undefined,
        cnpj: cnpj || undefined,
        sobre: sobre || undefined,
        termoAceito: aceito as true,
      });
      if (res.success) setEnviado(true);
      else setErro(res.error);
    } catch {
      setErro("Falha ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "#060c1a" }}>
        <div className="w-full max-w-md rounded-3xl p-8 text-center" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
          <h1 className="text-lg font-black text-white mb-2">Cadastro enviado!</h1>
          <p className="text-[13px] text-slate-400 leading-relaxed">
            Recebemos seus dados. A equipe da Alpha Comex vai analisar e entrar em contato em breve. Obrigado!
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4" style={{ background: "#060c1a" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-5">
        {/* Cabeçalho */}
        <header className="rounded-3xl p-6 text-center" style={{ background: "linear-gradient(135deg, rgba(30,64,175,0.25), rgba(15,23,42,0.7))", border: "1px solid rgba(59,130,246,0.25)" }}>
          <h1 className="text-xl font-black text-white">Parceria — Assessoria para Revisão de RADAR</h1>
          <p className="text-[12px] text-slate-400 mt-2">Preencha o formulário abaixo para iniciar a parceria com a Alpha Comex &amp; Compliance.</p>
        </header>

        {/* Campos */}
        <section className="rounded-3xl p-6 space-y-4" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Campo label="E-mail" obrigatorio>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="seu@email.com" />
          </Campo>

          <Campo label="Nome Completo" obrigatorio dica="Por gentileza, preencha com seu nome completo.">
            <input type="text" required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className={inputCls} />
          </Campo>

          <Campo label="CPF" dica="Por gentileza, preencha com seu CPF.">
            <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
          </Campo>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="UF - Estado" obrigatorio>
              <div className="relative">
                <select required value={uf} onChange={(e) => setUf(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                  <option value="">Selecione...</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </Campo>
            <Campo label="Município">
              <input type="text" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={inputCls} />
            </Campo>
          </div>

          <Campo label="Telefone" obrigatorio dica="Por gentileza, preencha com seu melhor telefone.">
            <input type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" />
          </Campo>

          <Campo label="Área de Atuação de sua empresa" dica="Selecione a(s) sua(s) área(s) de atuação.">
            <div className="grid sm:grid-cols-2 gap-2">
              {AREAS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold text-left transition-all"
                  style={{
                    background: areas.includes(a) ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.03)",
                    border: areas.includes(a) ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    color: areas.includes(a) ? "#93c5fd" : "#94a3b8",
                  }}
                >
                  <span className="w-3.5 h-3.5 rounded grid place-items-center shrink-0" style={{ border: areas.includes(a) ? "none" : "1px solid #475569", background: areas.includes(a) ? "#3b82f6" : "transparent" }}>
                    {areas.includes(a) && <CheckCircle2 size={11} className="text-white" />}
                  </span>
                  {a}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Nome da sua empresa">
            <input type="text" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} className={inputCls} />
          </Campo>

          <Campo label="CNPJ da sua empresa" dica="Opcional.">
            <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={inputCls} placeholder="00.000.000/0000-00" />
          </Campo>

          <Campo label="Gostaria de falar mais sobre você e sua empresa?" dica="Gostamos de conhecer bem os nossos parceiros.">
            <textarea value={sobre} onChange={(e) => setSobre(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </Campo>
        </section>

        {/* Termo */}
        {termo && (
          <section className="rounded-3xl p-6" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300 mb-3">Termos e Condições de Parceria</h2>
            <div className="max-h-72 overflow-y-auto rounded-xl p-4 text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {termo.conteudo}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Versão do termo: <span className="font-bold text-slate-500">{termo.versao}</span></p>

            <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
              <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-500" required />
              <span className="text-[12px] text-slate-300">
                Declaro que li e concordo com os termos e condições de parceria (Revisão de RADAR). <span className="text-rose-400">*</span>
              </span>
            </label>
          </section>
        )}

        {erro && (
          <div className="rounded-xl px-4 py-3 text-[12px] font-bold text-rose-300" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)" }}>
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando || !aceito}
          className="w-full h-13 rounded-2xl text-white text-[13px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 py-4"
          style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 8px 30px rgba(37,99,235,0.3)" }}
        >
          {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : "Enviar cadastro"}
        </button>
        <p className="text-center text-[10px] text-slate-700 pb-6">Alpha Comex &amp; Compliance · Nunca compartilhe senhas neste formulário.</p>
      </form>
    </main>
  );
}

const inputCls = "w-full h-11 px-3 rounded-xl text-[13px] text-white outline-none transition-all bg-black/40 border border-white/10 focus:border-blue-500/50 placeholder:text-slate-600";

function Campo({ label, obrigatorio, dica, children }: { label: string; obrigatorio?: boolean; dica?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-bold text-slate-200">
        {label} {obrigatorio && <span className="text-rose-400">*</span>}
      </label>
      {dica && <p className="text-[10.5px] text-slate-500 -mt-0.5">{dica}</p>}
      {children}
    </div>
  );
}
