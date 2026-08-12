"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BuscarEmpresasBpm, ListarUsuariosResponsavelBpm } from "@/actions/bpm/Cards";

interface CampoBpm {
  id: string;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  opcoesJson: string | null;
}

interface EmpresaOpcao {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
}

interface UsuarioOpcao {
  id: number;
  nome: string;
}

interface Props {
  pipelineId: string;
  etapaId: string;
  campos: CampoBpm[];
  currentUserId: number | null;
  accent: string;
  onClose: () => void;
  onCriado: (dados: unknown) => Promise<{ success: true } | { success: false; error: string }>;
}

const inputCls = "w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

export default function NovoCardModal({ pipelineId, etapaId, campos, currentUserId, accent, onClose, onCriado }: Props) {
  const [buscaEmpresa, setBuscaEmpresa] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaOpcao | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [responsavelId, setResponsavelId] = useState<number | null>(currentUserId);
  const [servico, setServico] = useState("");
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    ListarUsuariosResponsavelBpm().then((res) => {
      if (res.success && res.data) setUsuarios(res.data);
    });
  }, []);

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

  async function handleSalvar() {
    setErro(null);

    // D-021: empresa é sempre obrigatória para criar um card.
    if (!empresaSelecionada) {
      setErro("Selecione uma empresa — todo card precisa estar vinculado a uma empresa.");
      return;
    }
    if (!responsavelId) {
      setErro("Selecione um responsável.");
      return;
    }

    const camposFaltantes = campos.filter(
      (campo) => campo.obrigatorio && !valoresCampos[campo.id]?.trim(),
    );
    if (camposFaltantes.length > 0) {
      setErro(
        `Preencha os campos obrigatórios: ${camposFaltantes.map((campo) => campo.nome).join(", ")}.`,
      );
      return;
    }

    setSalvando(true);
    const resultado = await onCriado({
      empresaId: empresaSelecionada.id,
      pipelineId,
      etapaId,
      responsavelId,
      servico: servico || undefined,
      camposValores: valoresCampos,
    });
    setSalvando(false);

    if (!resultado.success) {
      setErro(resultado.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-bold text-white">Novo Card</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {erro && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {erro}
            </div>
          )}

          <FieldRow label="Empresa *">
            {empresaSelecionada ? (
              <div className="flex items-center justify-between bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
                <span className="text-sm text-white">{empresaSelecionada.nomeFantasia || empresaSelecionada.razaoSocial}</span>
                <button onClick={() => setEmpresaSelecionada(null)} className="text-xs text-slate-400 hover:text-white">
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  className={inputCls}
                  placeholder="Buscar por nome ou CNPJ..."
                  value={buscaEmpresa}
                  onChange={(e) => setBuscaEmpresa(e.target.value)}
                />
                {empresas.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {empresas.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => { setEmpresaSelecionada(emp); setEmpresas([]); setBuscaEmpresa(""); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                      >
                        {emp.nomeFantasia || emp.razaoSocial}
                        <span className="block text-[10px] text-slate-500">{emp.cnpj}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FieldRow>

          <FieldRow label="Responsável *">
            <select
              className={inputCls}
              value={responsavelId ?? ""}
              onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Selecione...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Serviço">
            <input className={inputCls} placeholder="Descrição do serviço" value={servico} onChange={(e) => setServico(e.target.value)} />
          </FieldRow>

          {campos.map((campo) => (
            <FieldRow key={campo.id} label={`${campo.nome}${campo.obrigatorio ? " *" : ""}`}>
              {campo.tipo === "selecao" && campo.opcoesJson ? (
                <select
                  className={inputCls}
                  required={campo.obrigatorio}
                  aria-required={campo.obrigatorio}
                  value={valoresCampos[campo.id] ?? ""}
                  onChange={(e) => setValoresCampos((prev) => ({ ...prev, [campo.id]: e.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {(JSON.parse(campo.opcoesJson) as string[]).map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputCls}
                  required={campo.obrigatorio}
                  aria-required={campo.obrigatorio}
                  type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
                  value={valoresCampos[campo.id] ?? ""}
                  onChange={(e) => setValoresCampos((prev) => ({ ...prev, [campo.id]: e.target.value }))}
                />
              )}
            </FieldRow>
          ))}
        </div>

        <div className="flex gap-2 p-5 border-t border-white/5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            {salvando ? "Salvando..." : "Criar Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
