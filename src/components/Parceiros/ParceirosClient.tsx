"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Handshake, Plus, Settings, Trash2, X, Loader2, AlertTriangle, FileText, Link2, UserPlus,
  MoreHorizontal, Search, Crown, Gem, Square, Users,
} from "lucide-react";
import { toast } from "sonner";
import ParceiroCard, { type CardParceiro } from "./ParceiroCard";
import ModalNovaIndicacao from "./ModalNovaIndicacao";
import ModalEngrenagem from "./ModalEngrenagem";
import ModalTermo from "./ModalTermo";
import ModalConvidarParceiro from "./ModalConvidarParceiro";
import ModalMensagemConvite from "./ModalMensagemConvite";
import ModalPreCadastros from "./ModalPreCadastros";
import { excluirParceiros } from "@/actions/parceiros";
import { getTema } from "@/lib/temas";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean };
type TemplateOnboarding = { id: number; nome: string; mensagem: string };

type Props = {
  parceiros: CardParceiro[];
  temaName: string;
  busca?: string;
  nivel?: string;
  permissao: Permissao;
  templateConvite: TemplateOnboarding | null;
};

export default function ParceirosClient({ parceiros, temaName, busca, nivel, permissao, templateConvite }: Props) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const router = useRouter();

  const [novaIndicacaoOpen, setNovaIndicacaoOpen] = useState(false);
  const [engrenagemOpen, setEngrenagemOpen] = useState(false);
  const [termoOpen, setTermoOpen] = useState(false);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [mensagemConvite, setMensagemConvite] = useState<{ link: string; pin: string } | null>(null);
  const [preCadastrosOpen, setPreCadastrosOpen] = useState(false);
  const [modoExclusao, setModoExclusao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de ações ao clicar fora
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Stats por nível (dá vida ao header)
  const stats = {
    total: parceiros.length,
    gold: parceiros.filter(p => p.nivel === "GOLD").length,
    platinum: parceiros.filter(p => p.nivel === "PLATINUM").length,
    black: parceiros.filter(p => p.nivel === "BLACK").length,
  };

  const toggleSelect = (id: number) =>
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const sairExclusao = () => { setModoExclusao(false); setSelecionados(new Set()); };

  const confirmarExclusao = async () => {
    setExcluindo(true);
    const res = await excluirParceiros([...selecionados]);
    setExcluindo(false);
    setConfirmOpen(false);
    if (res.success) {
      toast.success(`${res.count} parceiro(s) excluído(s)`);
      sairExclusao();
      router.refresh();
    } else {
      toast.error(res.error ?? "Erro ao excluir");
    }
  };

  const selecionadosNomes = parceiros.filter(p => selecionados.has(p.id)).map(p => p.nome);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header repaginado — banner com gradiente + stats vivos */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="relative rounded-3xl p-6 lg:p-7"
          style={{
            background: `linear-gradient(135deg, rgba(${accent},0.16) 0%, rgba(2,6,23,0.4) 55%, rgba(2,6,23,0.2) 100%)`,
            border: `1px solid rgba(${accent},0.22)`,
          }}
        >
          {/* glow decorativo — clipado num wrapper próprio (não corta o dropdown) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full blur-3xl opacity-40"
              style={{ background: `radial-gradient(circle, rgba(${accent},0.5), transparent 65%)` }} />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Identidade */}
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl shrink-0" style={{ background: `rgba(${accent},0.18)`, border: `1px solid rgba(${accent},0.4)`, boxShadow: `0 8px 30px rgba(${accent},0.25)` }}>
                <Handshake size={24} style={{ color: `rgba(${accent},1)` }} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black uppercase italic tracking-tight text-white leading-none">Parceiros</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold mt-1.5">Gestão de parcerias &amp; indicações</p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Modo exclusão (entra direto, fora do menu, por ser destrutivo) */}
              {permissao.podeExcluir && !modoExclusao && (
                <button onClick={() => setModoExclusao(true)} title="Excluir parceiros"
                  className="h-11 w-11 grid place-items-center rounded-2xl transition-all text-rose-300/80 hover:text-rose-300"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Trash2 size={16} />
                </button>
              )}

              {/* Menu de ações secundárias — desafoga o header */}
              {(permissao.isAdmin || permissao.podeEditar) && (
                <div className={`relative ${menuOpen ? "z-50" : ""}`} ref={menuRef}>
                  <button onClick={() => setMenuOpen(o => !o)} title="Mais ações"
                    className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-slate-200"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <MoreHorizontal size={16} /> Ações
                  </button>

                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-60 z-50 rounded-2xl overflow-hidden p-1.5"
                      style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" }}
                    >
                      {permissao.podeEditar && (
                        <MenuItem icon={<Link2 size={15} />} label="Convidar parceiro" hint="Gera link de convite"
                          onClick={() => { setConvidarOpen(true); setMenuOpen(false); }} accent={accent} />
                      )}
                      {permissao.podeEditar && (
                        <MenuItem icon={<UserPlus size={15} />} label="Pré-cadastros" hint="Aprovar respostas"
                          onClick={() => { setPreCadastrosOpen(true); setMenuOpen(false); }} accent={accent} />
                      )}
                      {permissao.isAdmin && (
                        <MenuItem icon={<FileText size={15} />} label="Atualizar termo"
                          onClick={() => { setTermoOpen(true); setMenuOpen(false); }} accent={accent} />
                      )}
                      {permissao.isAdmin && (
                        <MenuItem icon={<Settings size={15} />} label="Controle de acesso"
                          onClick={() => { setEngrenagemOpen(true); setMenuOpen(false); }} accent={accent} />
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Nova Indicação — ação relevante, fica visível */}
              {permissao.podeEditar && (
                <button onClick={() => setNovaIndicacaoOpen(true)}
                  className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-slate-100 hover:brightness-110"
                  style={{ background: `rgba(${accent},0.18)`, border: `1px solid rgba(${accent},0.4)` }}>
                  <Handshake size={15} /> Indicação
                </button>
              )}

              {/* Ação primária — destaque máximo */}
              <Link href="/PainelAlpha/Parceiros/novo"
                className="h-11 px-5 flex items-center gap-2 font-black uppercase text-[11px] tracking-widest rounded-2xl transition-all text-black hover:brightness-110"
                style={{ background: `rgba(${accent},1)`, boxShadow: `0 8px 24px rgba(${accent},0.35)` }}>
                <Plus size={16} strokeWidth={2.6} /> Novo Parceiro
              </Link>
            </div>
          </div>

          {/* Stats por nível — dão vida ao painel */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatCard icon={<Users size={16} />} label="Total" valor={stats.total} cor={accent} delay={0.05} />
            <StatCard icon={<Crown size={16} />} label="Gold" valor={stats.gold} cor="234,179,8" delay={0.1} />
            <StatCard icon={<Gem size={16} />} label="Platinum" valor={stats.platinum} cor="148,163,184" delay={0.15} />
            <StatCard icon={<Square size={16} />} label="Black" valor={stats.black} cor="100,116,139" delay={0.2} />
          </div>
        </motion.header>

        {/* Barra do modo exclusão */}
        {modoExclusao && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-[12px] font-bold text-red-300">
              {selecionados.size === 0 ? "Selecione os parceiros que deseja excluir" : `${selecionados.size} selecionado(s)`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={sairExclusao} className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-bold text-slate-300 bg-white/5 hover:bg-white/10">
                <X size={13} /> Cancelar
              </button>
              <button onClick={() => setConfirmOpen(true)} disabled={selecionados.size === 0}
                className="h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-40"
                style={{ background: "#dc2626" }}>
                <Trash2 size={13} /> Apagar selecionados
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        {!modoExclusao && (
          <form method="GET" className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input name="busca" defaultValue={busca ?? ""} placeholder="Buscar por nome, documento ou e-mail..."
                className="w-full h-11 bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/25 transition-colors" />
            </div>
            <select name="nivel" defaultValue={nivel ?? ""} className="h-11 bg-black/40 border border-white/10 rounded-2xl px-4 text-xs text-slate-400 uppercase font-black focus:outline-none focus:border-white/25 cursor-pointer transition-colors">
              <option value="">Todos os Níveis</option>
              <option value="GOLD">★ GOLD</option>
              <option value="PLATINUM">◆ PLATINUM</option>
              <option value="BLACK">■ BLACK</option>
            </select>
            <button type="submit" className="h-11 px-5 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all hover:brightness-110" style={{ background: `rgba(${accent}, 0.85)` }}>Filtrar</button>
          </form>
        )}

        {/* Lista */}
        {parceiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-600">
            <Handshake size={48} strokeWidth={1} />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum parceiro encontrado</p>
            <Link href="/PainelAlpha/Parceiros/novo" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: `rgba(${accent}, 1)` }}>
              + Cadastrar primeiro parceiro
            </Link>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {parceiros.map(p => (
              <motion.div
                key={p.id}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } } }}
              >
                <ParceiroCard parceiro={p} selecionavel={modoExclusao} selecionado={selecionados.has(p.id)} onToggleSelect={toggleSelect} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Modais */}
      <ModalNovaIndicacao open={novaIndicacaoOpen} onClose={() => setNovaIndicacaoOpen(false)} onDone={() => router.refresh()} accent={accent} />
      <ModalEngrenagem open={engrenagemOpen} onClose={() => setEngrenagemOpen(false)} accent={accent} />
      <ModalTermo open={termoOpen} onClose={() => setTermoOpen(false)} accent={accent} />
      <ModalConvidarParceiro
        open={convidarOpen}
        onClose={() => setConvidarOpen(false)}
        onConviteGerado={(dados) => setMensagemConvite(dados)}
      />
      {mensagemConvite && (
        <ModalMensagemConvite
          open
          onClose={() => setMensagemConvite(null)}
          link={mensagemConvite.link}
          pin={mensagemConvite.pin}
          template={templateConvite}
        />
      )}
      <ModalPreCadastros open={preCadastrosOpen} onClose={() => setPreCadastrosOpen(false)} isAdmin={permissao.isAdmin} onAprovado={() => router.refresh()} />

      {/* Confirmação de exclusão */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.85)", backdropFilter: "blur(6px)" }} onClick={() => !excluindo && setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-3xl p-5" style={{ background: "#0a1020", border: "1px solid rgba(239,68,68,0.35)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                <AlertTriangle size={17} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-black text-white">Excluir {selecionados.size} parceiro(s)?</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Esta ação é permanente e não pode ser desfeita.</p>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto mb-3 px-3 py-2 rounded-xl text-[11px] text-slate-300 space-y-0.5" style={{ background: "rgba(15,23,42,0.6)" }}>
              {selecionadosNomes.map((n, i) => <p key={i} className="truncate">• {n}</p>)}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} disabled={excluindo} className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={confirmarExclusao} disabled={excluindo}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-60" style={{ background: "#dc2626" }}>
                {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Item do menu de ações ──────────────────────────────────────────────────────
function MenuItem({ icon, label, hint, onClick, accent }: {
  icon: React.ReactNode; label: string; hint?: string; onClick: () => void; accent: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/5 group">
      <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 transition-colors"
        style={{ background: `rgba(${accent},0.12)`, color: `rgba(${accent},1)` }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-slate-200 leading-tight">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500 leading-tight">{hint}</span>}
      </span>
    </button>
  );
}

// ── Card de estatística (nível) ────────────────────────────────────────────────
function StatCard({ icon, label, valor, cor, delay }: {
  icon: React.ReactNode; label: string; valor: number; cor: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(${cor},0.25)` }}
    >
      <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `rgba(${cor},0.14)`, color: `rgb(${cor})` }}>
        {icon}
      </span>
      <div>
        <p className="text-xl font-black text-white leading-none tabular-nums">{valor}</p>
        <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-slate-500 mt-1">{label}</p>
      </div>
    </motion.div>
  );
}
