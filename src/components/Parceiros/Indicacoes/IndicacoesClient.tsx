"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Plus, Building2 } from "lucide-react";
import { getTema } from "@/lib/temas";
import type { ListarTodasIndicacoes } from "@/actions/parceiros-indicacoes";
import ModalNovaIndicacao from "@/components/Parceiros/ModalNovaIndicacao";

type Indicacao = Awaited<ReturnType<typeof ListarTodasIndicacoes>>["indicacoes"][number];

const STATUS_INDICACAO_STYLE: Record<string, { bg: string; color: string }> = {
  ATIVA: { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
  DESVINCULADA: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
};

export default function IndicacoesClient({
  temaName,
  podeEditar,
  indicacoesIniciais,
}: {
  temaName: string;
  podeEditar: boolean;
  indicacoesIniciais: Indicacao[];
}) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const router = useRouter();
  const [novaIndicacaoOpen, setNovaIndicacaoOpen] = useState(false);

  return (
    <div className="min-h-screen w-full" style={{ background: "#05070d" }}>
      <header className="px-6 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div>
          <h1 className="text-lg font-black text-slate-100">Indicações</h1>
          <p className="text-[11px] text-slate-500">Histórico de empresas indicadas por parceiros — {indicacoesIniciais.length} registro(s)</p>
        </div>
        {podeEditar && (
          <button
            onClick={() => setNovaIndicacaoOpen(true)}
            className="ml-auto flex items-center gap-2 h-11 px-4 rounded-2xl font-black uppercase text-[11px] tracking-widest text-black transition-all hover:brightness-110"
            style={{ background: `rgba(${accent},1)` }}
          >
            <Plus size={16} strokeWidth={2.6} /> Nova Indicação
          </button>
        )}
      </header>

      <div className="p-6">
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ background: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3">Parceiro</th>
                <th className="px-4 py-3">Empresa indicada</th>
                <th className="px-4 py-3">Serviço</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Oportunidade</th>
              </tr>
            </thead>
            <tbody>
              {indicacoesIniciais.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma indicação registrada.</td></tr>
              ) : indicacoesIniciais.map((i) => {
                const statusStyle = STATUS_INDICACAO_STYLE[i.status] ?? STATUS_INDICACAO_STYLE.DESVINCULADA;
                return (
                  <tr key={i.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="px-4 py-3 text-slate-200 font-bold">
                      <span className="flex items-center gap-1.5"><Handshake size={12} className="text-slate-500" /> {i.parceiro.nome}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="flex items-center gap-1.5"><Building2 size={12} className="text-slate-500" /> {i.empresa.razaoSocial}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{i.servicoIndicado ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(i.dataIndicacao).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {i.status === "ATIVA" ? "Ativa" : "Desvinculada"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {i.oportunidade ? `${i.oportunidade.pipelineNome} — ${i.oportunidade.etapaNome}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ModalNovaIndicacao
        open={novaIndicacaoOpen}
        onClose={() => setNovaIndicacaoOpen(false)}
        onDone={() => router.refresh()}
        accent={accent}
      />
    </div>
  );
}
