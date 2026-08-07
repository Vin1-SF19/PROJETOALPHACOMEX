"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Handshake, Plus, Settings, Trash2, X, Loader2, AlertTriangle, FileText, Link2, UserPlus,
  MoreHorizontal, Search, Crown, Gem, Square, Users, Bell, CircleHelp,
} from "lucide-react";
import { toast } from "sonner";
import ParceiroCard, { type CardParceiro } from "./ParceiroCard";
import ModalNovaIndicacao from "./ModalNovaIndicacao";
import ModalEngrenagem from "./ModalEngrenagem";
import ModalTermo from "./ModalTermo";
import ModalConvidarParceiro from "./ModalConvidarParceiro";
import ModalMensagemConvite from "./ModalMensagemConvite";
import ModalPreCadastros from "./ModalPreCadastros";
import ModalCredenciais from "./ModalCredenciais";
import { excluirParceiros } from "@/actions/parceiros";
import type { obterVideoIntrodutorioConfig } from "@/actions/video-introdutorio";
import { getTema } from "@/lib/temas";
import { useParceirosPreCadastroNotifications, type PreCadastroNotificacao } from "@/hooks/useParceirosPreCadastroNotifications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";
import { BotaoVideoIntrodutorio } from "@/components/VideoIntrodutorio/BotaoVideoIntrodutorio";
import type { ParceiroPendenteCadastro } from "@/lib/comercial/parceiro-nao-cadastrado";
import { GuiaModuloTour } from "@/components/Guias/GuiaModuloTour";
import { GavetaParceirosPendentes } from "./GavetaParceirosPendentes";
import {
  marcarTutorialModuloComoVisto,
  tutorialModuloFoiVisto,
  type ConfigTutorialModulo,
} from "@/lib/guias/tutorial-modulo";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean; podeAprovar: boolean };
type TemplateOnboarding = { id: number; nome: string; mensagem: string };
type VideoIntrodutorioConfig = Awaited<ReturnType<typeof obterVideoIntrodutorioConfig>>["data"];

// Partículas do fundo vivo — posições fixas em % + timing variado (evita padrão robótico)
const PARTICULAS_FUNDO = [
  { x: 8, y: 15, duracao: 5.5, delay: 0 },
  { x: 88, y: 12, duracao: 6.2, delay: 0.8 },
  { x: 15, y: 62, duracao: 5.8, delay: 1.4 },
  { x: 92, y: 55, duracao: 6.6, delay: 0.4 },
  { x: 45, y: 85, duracao: 5.2, delay: 1.8 },
  { x: 70, y: 30, duracao: 6.0, delay: 2.2 },
  { x: 30, y: 40, duracao: 5.6, delay: 1.0 },
] as const;

const TUTORIAL_PARCEIROS: ConfigTutorialModulo = {
  modulo: "parceiros",
  versao: 1,
  titulo: "Tutoriais de Parceiros",
  passos: [
    {
      id: "visao-geral",
      seletor: '[data-guia-parceiros="visao-geral"]',
      titulo: "Visão geral da parceria",
      descricao: "Aqui você acompanha totais por nível, acessos, indicações e as principais ações do módulo.",
    },
    {
      id: "novo-parceiro",
      seletor: '[data-guia-parceiros="novo-parceiro"]',
      titulo: "Cadastre um parceiro",
      descricao: "Use Novo Parceiro para cadastrar PF ou PJ, responsáveis, endereço, banco/Pix e a regra de comissão.",
    },
    {
      id: "nova-indicacao",
      seletor: '[data-guia-parceiros="nova-indicacao"]',
      titulo: "Vincule uma nova indicação",
      descricao: "Indicação relaciona um parceiro a um cliente que já existe no CS & NPS. Clientes novos nascem pelo fechamento do contrato no Alpha Metas.",
    },
    {
      id: "acoes",
      seletor: '[data-guia-parceiros="acoes"]',
      titulo: "Convites e pré-cadastros",
      descricao: "Em Ações, usuários autorizados geram link e PIN, revisam pré-cadastros e administram termo ou acesso.",
    },
    {
      id: "pendentes",
      seletor: '[data-guia-parceiros="pendentes-metas"]',
      titulo: "Finalize parceiros vindos do Metas",
      descricao: "A gaveta mostra quantos parceiros ainda não foram cadastrados. Abra-a, escolha Finalizar cadastro e complete os dados para fazer o vínculo com o contrato de origem.",
    },
    {
      id: "filtros",
      seletor: '[data-guia-parceiros="filtros"]',
      titulo: "Encontre rapidamente",
      descricao: "Busque por nome, documento ou e-mail e filtre a lista pelos níveis Gold, Platinum e Black.",
    },
    {
      id: "lista",
      seletor: '[data-guia-parceiros="lista"]',
      titulo: "Abra o detalhe do parceiro",
      descricao: "Clique em um card para consultar empresas indicadas, comissão, comprovantes, cadastro, responsáveis e acesso ao portal.",
    },
  ],
};

type Props = {
  userId: number;
  parceiros: CardParceiro[];
  temaName: string;
  busca?: string;
  nivel?: string;
  permissao: Permissao;
  templateConvite: TemplateOnboarding | null;
  templateParceiro: TemplateOnboarding | null;
  preCadastrosPendentesInicial: number;
  parceirosPendentesCadastro: ParceiroPendenteCadastro[];
  videoIntrodutorioConfig: VideoIntrodutorioConfig;
};

export default function ParceirosClient({
  userId, parceiros, temaName, busca, nivel, permissao, templateConvite, templateParceiro, preCadastrosPendentesInicial, parceirosPendentesCadastro, videoIntrodutorioConfig,
}: Props) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [tutorialAberto, setTutorialAberto] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        if (!tutorialModuloFoiVisto(window.localStorage, TUTORIAL_PARCEIROS, userId)) {
          setTutorialAberto(true);
        }
      } catch {
        setTutorialAberto(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [userId]);

  const finalizarTutorial = useCallback(() => {
    try {
      marcarTutorialModuloComoVisto(window.localStorage, TUTORIAL_PARCEIROS, userId);
    } catch {
      // O tour continua utilizável quando o navegador bloqueia armazenamento local.
    }
    setTutorialAberto(false);
  }, [userId]);

  // Filtro live — aplica direto na URL (via router.push), sem botão "Filtrar".
  // Mantém deep-linking: busca/nivel continuam vindo de searchParams no Server Component.
  const [buscaInput, setBuscaInput] = useState(busca ?? "");
  const aplicarFiltro = useCallback((novaBusca: string, novoNivel: string) => {
    const params = new URLSearchParams();
    if (novaBusca.trim()) params.set("busca", novaBusca.trim());
    if (novoNivel) params.set("nivel", novoNivel);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (buscaInput !== (busca ?? "")) aplicarFiltro(buscaInput, nivel ?? "");
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaInput]);

  const [videoIntrodutorioModalOpen, setVideoIntrodutorioModalOpen] = useState(false);
  const [novaIndicacaoOpen, setNovaIndicacaoOpen] = useState(false);
  const [engrenagemOpen, setEngrenagemOpen] = useState(false);
  const [termoOpen, setTermoOpen] = useState(false);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [mensagemConvite, setMensagemConvite] = useState<{ link: string; pin: string } | null>(null);
  const [preCadastrosOpen, setPreCadastrosOpen] = useState(false);
  const [preCadastroIdFoco, setPreCadastroIdFoco] = useState<number | undefined>(undefined);
  const [credenciaisAprovado, setCredenciaisAprovado] = useState<{ loginEmail: string; senhaGerada: string; nomeParceiro: string } | null>(null);
  const [modoExclusao, setModoExclusao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [pendentesCount, setPendentesCount] = useState(preCadastrosPendentesInicial);
  const [pendentesRecentes, setPendentesRecentes] = useState<PreCadastroNotificacao[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const podeVerNotificacoes = permissao.isAdmin || permissao.podeAprovar;

  useParceirosPreCadastroNotifications(podeVerNotificacoes, (payload) => {
    setPendentesCount((c) => c + 1);
    setPendentesRecentes((prev) => [payload, ...prev].slice(0, 10));
  });

  useEffect(() => {
    if (!notificacoesOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificacoesOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notificacoesOpen]);

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
    <main className="relative min-h-screen bg-[#020617] text-slate-200 p-6 lg:p-10 overflow-hidden">
      {/* Fundo vivo — shader animado (WebGL) + glows lentos + partículas flutuantes */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {!reduceMotion && (
          <div className="absolute inset-0 opacity-70">
            <AnimatedShaderBackground pausado={videoIntrodutorioModalOpen} />
          </div>
        )}
        <div className="absolute inset-0 bg-[#020617]/60" />
        {/* Glows/partículas em loop competem por GPU com o <video> do modal de
            Vídeo Introdutório (blur(140px) + shader WebGL + <video> decode no
            mesmo compositor causa frame congelado) — pausadas junto com o
            shader enquanto esse modal está aberto, mesmo padrão de reduceMotion. */}
        <motion.div
          className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
          style={{ background: `rgba(${accent},0.16)`, filter: "blur(140px)" }}
          animate={reduceMotion || videoIntrodutorioModalOpen ? { opacity: 0.5 } : { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={reduceMotion || videoIntrodutorioModalOpen ? undefined : { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-24 w-[500px] h-[500px] rounded-full"
          style={{ background: "rgba(99,102,241,0.12)", filter: "blur(130px)" }}
          animate={reduceMotion || videoIntrodutorioModalOpen ? { opacity: 0.5 } : { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={reduceMotion || videoIntrodutorioModalOpen ? undefined : { duration: 11, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1.2 }}
        />
        {!reduceMotion && !videoIntrodutorioModalOpen && PARTICULAS_FUNDO.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: `rgba(${accent},0.5)`, boxShadow: `0 0 8px rgba(${accent},0.5)` }}
            animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: p.duracao, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: p.delay }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto space-y-8">

        {/* Header repaginado — banner com gradiente + stats vivos */}
        <motion.header
          data-guia-parceiros="visao-geral"
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
            <div data-guia-parceiros="acoes" className="flex items-center gap-2 flex-wrap">
              {/* Notificação de pré-cadastro pendente — pulsa quando há itens */}
              {podeVerNotificacoes && (
                <div className={`relative ${notificacoesOpen ? "z-50" : ""}`} ref={notifRef}>
                  <motion.button
                    onClick={() => setNotificacoesOpen((o) => !o)}
                    title="Pré-cadastros pendentes"
                    className="relative h-11 w-11 grid place-items-center rounded-2xl transition-all text-amber-300/90 hover:text-amber-300"
                    style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
                    animate={pendentesCount > 0 ? { boxShadow: ["0 0 0 rgba(245,158,11,0.4)", "0 0 14px rgba(245,158,11,0.7)", "0 0 0 rgba(245,158,11,0.4)"] } : undefined}
                    transition={pendentesCount > 0 ? { duration: 1.8, repeat: Infinity, repeatType: "mirror" } : undefined}
                  >
                    <Bell size={16} />
                    {pendentesCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black grid place-items-center">
                        {pendentesCount > 99 ? "99+" : pendentesCount}
                      </span>
                    )}
                  </motion.button>

                  {notificacoesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-72 z-50 rounded-2xl overflow-hidden p-1.5 max-h-80 overflow-y-auto"
                      style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 50px rgba(0,0,0,0.6)" }}
                    >
                      {pendentesRecentes.length === 0 ? (
                        <p className="text-[11px] text-slate-600 text-center py-4">Nenhuma notificação recente.</p>
                      ) : (
                        pendentesRecentes.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPreCadastroIdFoco(p.id);
                              setPreCadastrosOpen(true);
                              setNotificacoesOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/5"
                          >
                            <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0 bg-amber-500/10">
                              <UserPlus size={13} className="text-amber-400" />
                            </div>
                            <span className="text-[12px] text-slate-200 truncate">
                              <span className="font-bold">{p.nomeCompleto}</span> completou o formulário
                            </span>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Modo exclusão (entra direto, fora do menu, por ser destrutivo) */}
              {permissao.podeExcluir && !modoExclusao && (
                <button onClick={() => setModoExclusao(true)} title="Excluir parceiros"
                  className="h-11 w-11 grid place-items-center rounded-2xl transition-all text-rose-300/80 hover:text-rose-300"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Trash2 size={16} />
                </button>
              )}

              {/* Vídeo Introdutório — Admin sempre vê; demais usuários só enquanto ativo (7 dias) */}
              <BotaoVideoIntrodutorio
                modulo="parceiros"
                isAdmin={permissao.isAdmin}
                configInicial={videoIntrodutorioConfig}
                aoAlternarModal={setVideoIntrodutorioModalOpen}
              />

              <button
                type="button"
                onClick={() => setTutorialAberto(true)}
                title="Rever tutoriais"
                className="h-11 px-3 flex items-center gap-2 rounded-2xl text-[10px] font-black uppercase tracking-wider text-slate-300 transition-all hover:text-white"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <CircleHelp size={15} /> Tutoriais
              </button>

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
                          onClick={() => { setPreCadastroIdFoco(undefined); setPreCadastrosOpen(true); setMenuOpen(false); }} accent={accent} />
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
                <button data-guia-parceiros="nova-indicacao" onClick={() => setNovaIndicacaoOpen(true)}
                  className="h-11 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-slate-100 hover:brightness-110"
                  style={{ background: `rgba(${accent},0.18)`, border: `1px solid rgba(${accent},0.4)` }}>
                  <Handshake size={15} /> Indicação
                </button>
              )}

              {/* Ação primária — destaque máximo */}
              <Link data-guia-parceiros="novo-parceiro" href="/PainelAlpha/Parceiros/novo"
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

        <GavetaParceirosPendentes pendencias={parceirosPendentesCadastro} accent={accent} />

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

        {/* Filtros — live, sem botão "Filtrar": aplica ao digitar (debounce) ou trocar o nível */}
        {!modoExclusao && (
          <div data-guia-parceiros="filtros" className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                placeholder="Buscar por nome, documento ou e-mail..."
                className="w-full h-11 bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/25 transition-colors"
              />
            </div>
            <Select value={nivel ?? "TODOS"} onValueChange={(v) => aplicarFiltro(buscaInput, v === "TODOS" ? "" : v)}>
              <SelectTrigger className="h-11 min-w-[170px] bg-black/40 border-white/10 rounded-2xl px-4 text-xs text-slate-300 uppercase font-black hover:bg-black/50 focus:ring-0 focus:border-white/25 [&>svg]:text-slate-500">
                <SelectValue placeholder="Todos os Níveis" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1020] border-white/10 text-slate-200">
                <SelectItem value="TODOS" className="text-xs uppercase font-bold focus:bg-white/10 focus:text-white">Todos os Níveis</SelectItem>
                <SelectItem value="GOLD" className="text-xs uppercase font-bold focus:bg-white/10 focus:text-white">★ GOLD</SelectItem>
                <SelectItem value="PLATINUM" className="text-xs uppercase font-bold focus:bg-white/10 focus:text-white">◆ PLATINUM</SelectItem>
                <SelectItem value="BLACK" className="text-xs uppercase font-bold focus:bg-white/10 focus:text-white">■ BLACK</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lista */}
        {parceiros.length === 0 ? (
          <div data-guia-parceiros="lista" className="flex flex-col items-center justify-center py-24 gap-4 text-slate-600">
            <Handshake size={48} strokeWidth={1} />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum parceiro encontrado</p>
            <Link href="/PainelAlpha/Parceiros/novo" className="text-xs font-black uppercase tracking-widest hover:underline" style={{ color: `rgba(${accent}, 1)` }}>
              + Cadastrar primeiro parceiro
            </Link>
          </div>
        ) : (
          <motion.div
            data-guia-parceiros="lista"
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
                <ParceiroCard parceiro={p} selecionavel={modoExclusao} selecionado={selecionados.has(p.id)} onToggleSelect={toggleSelect} podeDesativar={permissao.isAdmin} />
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
        onConviteGerado={(dados) => {
          setConvidarOpen(false);
          setMensagemConvite(dados);
        }}
        onReabrirMensagem={(dados) => {
          setConvidarOpen(false);
          setMensagemConvite(dados);
        }}
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
      <ModalPreCadastros
        open={preCadastrosOpen}
        onClose={() => setPreCadastrosOpen(false)}
        isAdmin={podeVerNotificacoes}
        preCadastroIdFoco={preCadastroIdFoco}
        onAprovado={(parceiro) => {
          setPreCadastrosOpen(false);
          setPendentesCount((c) => Math.max(0, c - 1));
          setPendentesRecentes((prev) => prev.filter((p) => p.nomeCompleto !== parceiro.nome));
          setCredenciaisAprovado({ loginEmail: parceiro.loginEmail, senhaGerada: parceiro.senhaGerada, nomeParceiro: parceiro.nome });
          router.refresh();
        }}
      />
      {credenciaisAprovado && (
        <ModalCredenciais
          open
          onClose={() => setCredenciaisAprovado(null)}
          loginEmail={credenciaisAprovado.loginEmail}
          senhaGerada={credenciaisAprovado.senhaGerada}
          nomeParceiro={credenciaisAprovado.nomeParceiro}
          template={templateParceiro}
        />
      )}

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

      <GuiaModuloTour
        aberto={tutorialAberto}
        config={TUTORIAL_PARCEIROS}
        accent={accent}
        onFinalizar={finalizarTutorial}
      />
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
