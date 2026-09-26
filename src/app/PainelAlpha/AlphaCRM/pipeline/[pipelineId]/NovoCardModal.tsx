"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Loader2, X } from "lucide-react";
import { BuscarEmpresaPorCnpjBpm, BuscarEmpresasBpm, ListarUsuariosResponsavelBpm } from "@/actions/bpm/Cards";
import { formatCNPJ, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";

interface EmpresaOpcao {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  uf?: string | null;
  municipio?: string | null;
}

interface NovaEmpresaForm {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  municipio: string;
}

interface UsuarioOpcao {
  id: number;
  nome: string;
}

interface Props {
  pipelineId: string;
  etapaId: string;
  etapaNome: string;
  currentUserId: number | null;
  accent: string;
  onClose: () => void;
  onCriado: (dados: unknown) => Promise<{ success: true } | { success: false; error: string }>;
}

const NOVA_EMPRESA_VAZIA: NovaEmpresaForm = {
  cnpj: "",
  razaoSocial: "",
  nomeFantasia: "",
  uf: "",
  municipio: "",
};

const inputCls = "w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-[11px] text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

export default function NovoCardModal({
  pipelineId,
  etapaId,
  etapaNome,
  currentUserId,
  accent,
  onClose,
  onCriado,
}: Props) {
  const [form, setForm] = useState<NovaEmpresaForm>(NOVA_EMPRESA_VAZIA);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaOpcao | null>(null);
  const [vinculoAutomatico, setVinculoAutomatico] = useState(false);
  const [empresasSugestoes, setEmpresasSugestoes] = useState<EmpresaOpcao[]>([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [responsavelId, setResponsavelId] = useState<number | null>(currentUserId);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroBuscaCnpj, setErroBuscaCnpj] = useState<string | null>(null);
  const cnpjRequest = useRef(0);

  function cancelarBuscaCnpj() {
    cnpjRequest.current += 1;
    setBuscandoCnpj(false);
  }

  useEffect(() => () => { cnpjRequest.current += 1; }, []);

  useEffect(() => {
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !salvando) onClose();
    };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [onClose, salvando]);

  useEffect(() => {
    ListarUsuariosResponsavelBpm(pipelineId).then((res) => {
      if (res.success && res.data) {
        setUsuarios(res.data);
        setResponsavelId((atual) =>
          atual && res.data.some((usuario) => usuario.id === atual) ? atual : null,
        );
      }
    });
  }, [pipelineId]);

  // Autocomplete de Razão Social → busca empresas existentes
  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      const termo = form.razaoSocial.trim();
      if (termo.length >= 2 && !empresaSelecionada) {
        BuscarEmpresasBpm(termo).then((res) => {
          if (!active) return;
          if (res.success && res.data) {
            setEmpresasSugestoes(res.data);
            setDropdownAberto(res.data.length > 0);
          } else {
            setEmpresasSugestoes([]);
            setDropdownAberto(false);
          }
        });
      } else {
        setEmpresasSugestoes([]);
        setDropdownAberto(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timeout); };
  }, [form.razaoSocial, empresaSelecionada]);

  // O cadastro interno tem prioridade; só consultamos a Receita para CNPJ novo.
  async function buscarCnpjReceita(cnpjValor: string, requestId: number) {
    const cnpjLimpo = normalizarCNPJ(cnpjValor);
    if (cnpjLimpo.length !== 14) return;
    setErroBuscaCnpj(null);
    setBuscandoCnpj(true);
    try {
      const empresaInterna = await BuscarEmpresaPorCnpjBpm(cnpjLimpo);
      if (requestId !== cnpjRequest.current) return;
      if (!empresaInterna.success) {
        setErroBuscaCnpj(empresaInterna.error ?? "Não foi possível consultar o cadastro interno");
        return;
      }
      if (empresaInterna.data) {
        const empresa = empresaInterna.data;
        setEmpresaSelecionada(empresa);
        setVinculoAutomatico(true);
        setForm({
          cnpj: normalizarCNPJ(empresa.cnpj) || cnpjLimpo,
          razaoSocial: empresa.razaoSocial,
          nomeFantasia: empresa.nomeFantasia || "",
          uf: empresa.uf || "",
          municipio: empresa.municipio || "",
        });
        setEmpresasSugestoes([]);
        setDropdownAberto(false);
        return;
      }
      const resposta = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
      const dados = await resposta.json();
      if (requestId !== cnpjRequest.current) return;
      if (!resposta.ok || dados.error) {
        setErroBuscaCnpj(dados.error || "Não foi possível buscar os dados do CNPJ");
        return;
      }
      setForm((anterior) => ({
        ...anterior,
        razaoSocial: dados.razaoSocial || anterior.razaoSocial,
        nomeFantasia: dados.nomeFantasia || anterior.nomeFantasia,
        uf: dados.uf || anterior.uf,
        municipio: dados.municipio || anterior.municipio,
      }));
      setEmpresaSelecionada(null);
    } catch {
      if (requestId === cnpjRequest.current)
        setErroBuscaCnpj("Erro ao buscar CNPJ. Tente novamente.");
    } finally {
      if (requestId === cnpjRequest.current) setBuscandoCnpj(false);
    }
  }

  // Handler do input CNPJ: auto-busca ao completar 14 dígitos
  function handleCnpjChange(valor: string) {
    cancelarBuscaCnpj();
    const cnpjLimpo = normalizarCNPJ(valor);
    setForm((anterior) => ({ ...(empresaSelecionada ? NOVA_EMPRESA_VAZIA : anterior), cnpj: cnpjLimpo }));
    setEmpresaSelecionada(null);
    setVinculoAutomatico(false);
    setErroBuscaCnpj(null);
    if (cnpjLimpo.length === 14) {
      void buscarCnpjReceita(cnpjLimpo, cnpjRequest.current);
    }
  }

  // Selecionar empresa do dropdown
  function selecionarEmpresa(empresa: EmpresaOpcao) {
    cancelarBuscaCnpj();
    setEmpresaSelecionada(empresa);
    setVinculoAutomatico(false);
    setForm((anterior) => ({
      ...anterior,
      cnpj: empresa.cnpj ? normalizarCNPJ(empresa.cnpj) : anterior.cnpj,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia || "",
      municipio: empresa.municipio || "",
      uf: empresa.uf || "",
    }));
    setEmpresasSugestoes([]);
    setDropdownAberto(false);
  }

  async function handleSalvar() {
    setErro(null);

    if (!empresaSelecionada) {
      if (normalizarCNPJ(form.cnpj).length !== 14) {
        setErro("Informe um CNPJ válido (14 dígitos).");
        return;
      }
      if (!form.razaoSocial.trim()) {
        setErro("Informe a razão social da empresa.");
        return;
      }
    }
    if (!responsavelId) {
      setErro("Selecione um responsável.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await onCriado({
        ...(empresaSelecionada
          ? { empresaId: empresaSelecionada.id }
          : {
              novaEmpresa: {
                cnpj: normalizarCNPJ(form.cnpj),
                razaoSocial: form.razaoSocial.trim(),
                nomeFantasia: form.nomeFantasia.trim() || undefined,
                uf: form.uf.trim() || undefined,
                municipio: form.municipio.trim() || undefined,
              },
            }),
        pipelineId,
        etapaId,
        responsavelId,
      });
      if (!resultado.success) setErro(resultado.error);
    } catch {
      setErro("Não foi possível criar o card. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="novo-card-titulo" className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 id="novo-card-titulo" className="font-bold text-white">Novo Card</h3>
          <button type="button" onClick={onClose} disabled={salvando} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {erro && <div role="alert" className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{erro}</div>}

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" aria-label="Orientação sobre o novo card">
            <div className="flex items-start gap-2.5">
              <ClipboardCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: `rgb(${accent})` }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Criar em</p>
                <p className="text-sm font-semibold text-white">{etapaNome}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Os detalhes da etapa são preenchidos ao abrir o card, na aba Formulário da Etapa.
                </p>
              </div>
            </div>
          </section>

          <FieldRow label="Empresa *" htmlFor="novo-card-empresa">
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-800/60 p-3">
              {/* CNPJ — auto-busca na Receita Federal ao completar 14 dígitos */}
              <div className="flex gap-2">
                <input
                  id="novo-card-empresa"
                  autoFocus
                  aria-label="CNPJ"
                  inputMode="numeric"
                  maxLength={18}
                  className={`${inputCls} font-mono`}
                  placeholder="00.000.000/0000-00"
                  value={formatarCNPJProgressivo(form.cnpj)}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                />
                {buscandoCnpj && (
                  <span className="flex items-center px-2">
                    <Loader2 size={14} aria-hidden="true" className="animate-spin text-blue-400" />
                  </span>
                )}
              </div>
              {erroBuscaCnpj && <p role="alert" className="text-[11px] text-rose-400">{erroBuscaCnpj}</p>}
              {vinculoAutomatico && empresaSelecionada && (
                <p role="status" className="text-[11px] text-emerald-300">Empresa encontrada pelo CNPJ e vinculada automaticamente.</p>
              )}

              {/* Razão Social — autocomplete de empresas existentes */}
              <div className="relative">
                <input
                  aria-label="Razão social"
                  className={inputCls}
                  placeholder="Razão social *"
                  value={form.razaoSocial}
                  readOnly={Boolean(empresaSelecionada)}
                  onChange={(e) => {
                    cancelarBuscaCnpj();
                    setForm((anterior) => ({ ...anterior, razaoSocial: e.target.value }));
                    setEmpresaSelecionada(null);
                  }}
                  onFocus={() => {
                    if (empresasSugestoes.length > 0) setDropdownAberto(true);
                  }}
                />
                {dropdownAberto && empresasSugestoes.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-lg">
                    {empresasSugestoes.map((empresa) => (
                      <button
                        key={empresa.id}
                        type="button"
                        onClick={() => selecionarEmpresa(empresa)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                      >
                        {empresa.nomeFantasia || empresa.razaoSocial}
                        <span className="block text-[10px] text-slate-500">{formatCNPJ(empresa.cnpj) ?? empresa.cnpj}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nome Fantasia */}
              <input
                aria-label="Nome fantasia"
                className={inputCls}
                placeholder="Nome fantasia"
                value={form.nomeFantasia}
                readOnly={Boolean(empresaSelecionada)}
                onChange={(e) => { cancelarBuscaCnpj(); setForm((anterior) => ({ ...anterior, nomeFantasia: e.target.value })); }}
              />

              {/* Município + UF */}
              <div className="grid grid-cols-3 gap-2">
                <input
                  aria-label="Município"
                  className={`${inputCls} col-span-2`}
                  placeholder="Município"
                  value={form.municipio}
                  readOnly={Boolean(empresaSelecionada)}
                  onChange={(e) => { cancelarBuscaCnpj(); setForm((anterior) => ({ ...anterior, municipio: e.target.value })); }}
                />
                <input
                  aria-label="UF"
                  className={inputCls}
                  placeholder="UF"
                  maxLength={2}
                  value={form.uf}
                  readOnly={Boolean(empresaSelecionada)}
                  onChange={(e) => { cancelarBuscaCnpj(); setForm((anterior) => ({ ...anterior, uf: e.target.value.toUpperCase() })); }}
                />
              </div>
            </div>
          </FieldRow>

          <FieldRow label="Responsável *" htmlFor="novo-card-responsavel">
            <select id="novo-card-responsavel" className={inputCls} value={responsavelId ?? ""} onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecione...</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
            </select>
          </FieldRow>


        </div>

        <div className="flex gap-2 p-5 border-t border-white/5">
          <button type="button" onClick={onClose} disabled={salvando} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleSalvar} disabled={salvando} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: `rgba(${accent},0.85)` }}>
            {salvando ? "Salvando..." : "Criar Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
