"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Search, X } from "lucide-react";
import { BuscarEmpresasBpm, ListarUsuariosResponsavelBpm } from "@/actions/bpm/Cards";

interface EmpresaOpcao {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
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

function formatarCnpjInput(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
}

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
  currentUserId,
  accent,
  onClose,
  onCriado,
}: Props) {
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaOpcao | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [responsavelId, setResponsavelId] = useState<number | null>(currentUserId);
  const [servico, setServico] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modoCadastro, setModoCadastro] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState<NovaEmpresaForm>(NOVA_EMPRESA_VAZIA);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroBuscaCnpj, setErroBuscaCnpj] = useState<string | null>(null);

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (buscaEmpresa.trim().length >= 2) {
        BuscarEmpresasBpm(buscaEmpresa).then((res) => {
          if (res.success && res.data) setEmpresas(res.data);
        });
      } else {
        setEmpresas([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [buscaEmpresa]);

  async function buscarCnpjReceita() {
    const cnpjLimpo = novaEmpresa.cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      setErroBuscaCnpj("Informe um CNPJ válido (14 dígitos)");
      return;
    }
    setErroBuscaCnpj(null);
    setBuscandoCnpj(true);
    try {
      const resposta = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
      const dados = await resposta.json();
      if (!resposta.ok || dados.error) {
        setErroBuscaCnpj(dados.error || "Não foi possível buscar os dados do CNPJ");
        return;
      }
      setNovaEmpresa((anterior) => ({
        ...anterior,
        razaoSocial: dados.razaoSocial || anterior.razaoSocial,
        nomeFantasia: dados.nomeFantasia || anterior.nomeFantasia,
        uf: dados.uf || anterior.uf,
        municipio: dados.municipio || anterior.municipio,
      }));
    } catch {
      setErroBuscaCnpj("Erro ao buscar CNPJ. Tente novamente.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function handleSalvar() {
    setErro(null);

    if (modoCadastro) {
      if (novaEmpresa.cnpj.replace(/\D/g, "").length !== 14) {
        setErro("Informe um CNPJ válido (14 dígitos).");
        return;
      }
      if (!novaEmpresa.razaoSocial.trim()) {
        setErro("Informe a razão social da empresa.");
        return;
      }
    } else if (!empresaSelecionada) {
      setErro("Selecione uma empresa — todo card precisa estar vinculado a uma empresa.");
      return;
    }
    if (!responsavelId) {
      setErro("Selecione um responsável.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await onCriado({
        ...(modoCadastro
          ? {
              novaEmpresa: {
                cnpj: novaEmpresa.cnpj.replace(/\D/g, ""),
                razaoSocial: novaEmpresa.razaoSocial.trim(),
                nomeFantasia: novaEmpresa.nomeFantasia.trim() || undefined,
                uf: novaEmpresa.uf.trim() || undefined,
                municipio: novaEmpresa.municipio.trim() || undefined,
              },
            }
          : { empresaId: empresaSelecionada!.id }),
        pipelineId,
        etapaId,
        responsavelId,
        servico: servico.trim() || undefined,
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
                <p className="text-sm font-semibold text-white">Novos Leads</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Os detalhes da etapa são preenchidos ao abrir o card, na aba Formulário da Etapa.
                </p>
              </div>
            </div>
          </section>

          <FieldRow label="Empresa *" htmlFor="novo-card-empresa">
            {modoCadastro ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-800/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cadastrar empresa nova</span>
                  <button type="button" onClick={() => { setModoCadastro(false); setNovaEmpresa(NOVA_EMPRESA_VAZIA); setErroBuscaCnpj(null); }} className="text-xs text-slate-400 hover:text-white">Buscar existente</button>
                </div>
                <div className="flex gap-2">
                  <input id="novo-card-empresa" autoFocus aria-label="CNPJ" className={`${inputCls} font-mono`} placeholder="00.000.000/0000-00" value={novaEmpresa.cnpj} onChange={(e) => setNovaEmpresa((anterior) => ({ ...anterior, cnpj: formatarCnpjInput(e.target.value) }))} />
                  <button type="button" aria-label="Buscar CNPJ" onClick={buscarCnpjReceita} disabled={buscandoCnpj} className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shrink-0 transition-all disabled:opacity-50 flex items-center justify-center">
                    {buscandoCnpj ? <Loader2 size={14} aria-hidden="true" className="animate-spin" /> : <Search size={14} aria-hidden="true" />}
                  </button>
                </div>
                {erroBuscaCnpj && <p role="alert" className="text-[11px] text-rose-400">{erroBuscaCnpj}</p>}
                <input aria-label="Razão social" className={inputCls} placeholder="Razão social *" value={novaEmpresa.razaoSocial} onChange={(e) => setNovaEmpresa((anterior) => ({ ...anterior, razaoSocial: e.target.value }))} />
                <input aria-label="Nome fantasia" className={inputCls} placeholder="Nome fantasia" value={novaEmpresa.nomeFantasia} onChange={(e) => setNovaEmpresa((anterior) => ({ ...anterior, nomeFantasia: e.target.value }))} />
                <div className="grid grid-cols-3 gap-2">
                  <input aria-label="Município" className={`${inputCls} col-span-2`} placeholder="Município" value={novaEmpresa.municipio} onChange={(e) => setNovaEmpresa((anterior) => ({ ...anterior, municipio: e.target.value }))} />
                  <input aria-label="UF" className={inputCls} placeholder="UF" maxLength={2} value={novaEmpresa.uf} onChange={(e) => setNovaEmpresa((anterior) => ({ ...anterior, uf: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            ) : empresaSelecionada ? (
              <div className="flex items-center justify-between bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
                <span className="text-sm text-white">{empresaSelecionada.nomeFantasia || empresaSelecionada.razaoSocial}</span>
                <button type="button" onClick={() => setEmpresaSelecionada(null)} className="text-xs text-slate-400 hover:text-white">Trocar</button>
              </div>
            ) : (
              <div className="relative">
                <input id="novo-card-empresa" autoFocus className={inputCls} placeholder="Buscar por nome ou CNPJ..." value={buscaEmpresa} onChange={(e) => setBuscaEmpresa(e.target.value)} />
                {empresas.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {empresas.map((empresa) => (
                      <button key={empresa.id} type="button" onClick={() => { setEmpresaSelecionada(empresa); setEmpresas([]); setBuscaEmpresa(""); }} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                        {empresa.nomeFantasia || empresa.razaoSocial}
                        <span className="block text-[10px] text-slate-500">{empresa.cnpj}</span>
                      </button>
                    ))}
                  </div>
                )}
                {buscaEmpresa.trim().length >= 2 && empresas.length === 0 && (
                  <button type="button" onClick={() => { setModoCadastro(true); setNovaEmpresa((anterior) => ({ ...anterior, razaoSocial: buscaEmpresa })); setBuscaEmpresa(""); }} className="mt-1.5 w-full text-left px-3 py-2 rounded-xl text-xs text-blue-400 hover:bg-blue-500/10 border border-dashed border-blue-500/30">
                    Não encontrada — cadastrar empresa nova
                  </button>
                )}
              </div>
            )}
          </FieldRow>

          <FieldRow label="Responsável *" htmlFor="novo-card-responsavel">
            <select id="novo-card-responsavel" className={inputCls} value={responsavelId ?? ""} onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecione...</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
            </select>
          </FieldRow>

          <FieldRow label="Serviço" htmlFor="novo-card-servico">
            <input id="novo-card-servico" className={inputCls} placeholder="Descrição do serviço" value={servico} onChange={(e) => setServico(e.target.value)} />
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
