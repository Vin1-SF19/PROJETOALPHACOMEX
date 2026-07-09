"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  TrendingUp,
  User,
  FileChartLine,
  Building2,
  Landmark,
  Zap,
  Eye,
  ArrowDownAZ,
  ArrowUpZA,
  CalendarClock,
  CalendarPlus,
  Filter,
  ChevronDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";
import { ListarExtratos } from "@/actions/Extratos";
import { getUsers } from "@/actions/get-user";
import { ModalNovaEmpresa } from "./ModalNovaEmpresa";
import { ModalConferencia } from "./ModalConferencia";
import { exportarRelatorioExcel, type TransacaoParaExportar } from "./lib/exportar-excel";
import { formatarCnpj } from "./lib/formatters";
import { fmtDate, fmtTime } from "@/lib/format-date";
import { getTema } from "@/lib/temas";

interface BancoComTransacoes {
  id: number;
  nomeBanco: string;
  transacoes: { id: string; data: Date | null; descricao: string; valor: number }[];
}

interface PeriodoComBancos {
  id: number;
  mes: string;
  ano: string;
  bancos: BancoComTransacoes[];
}

interface ExtratoEmpresa {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string | null;
  uf: string | null;
  regimeTributario: string | null;
  analistaResponsavel: string | null;
  criadoPorNome: string | null;
  createdAt: Date;
  periodos: PeriodoComBancos[];
}

const DEBOUNCE_MS = 400;

type OrdenacaoChave = "az" | "za" | "recente" | "antigo";

const OPCOES_ORDENACAO: { valor: OrdenacaoChave; label: string; icon: typeof ArrowDownAZ }[] = [
  { valor: "recente", label: "Data de Adição (Recente)", icon: CalendarPlus },
  { valor: "antigo", label: "Data de Adição (Antiga)", icon: CalendarClock },
  { valor: "az", label: "Razão Social (A-Z)", icon: ArrowDownAZ },
  { valor: "za", label: "Razão Social (Z-A)", icon: ArrowUpZA },
];

/** Botão com spotlight que segue o cursor — gradiente radial ancorado na posição do mouse. */
function BotaoSpotlight({ onClick, accent, children }: { onClick: () => void; accent: string; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors hover:text-white active:scale-95 shadow-xl shadow-white/5 overflow-hidden"
    >
      <span
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(160px circle at ${pos.x}px ${pos.y}px, rgba(${accent},0.9), transparent 70%)`,
        }}
      />
      <span className="relative z-10 flex items-center gap-3">{children}</span>
    </button>
  );
}

/**
 * Wrapper de tilt 3D real: o card inclina seguindo a posição do cursor (spring physics),
 * em vez de um `whileHover` fixo. Desativado por completo se o usuário preferir menos
 * movimento (`prefers-reduced-motion`).
 */
function TiltCard({ children, className, glowColor, accentBorder }: {
  children: React.ReactNode;
  className?: string;
  glowColor: string;
  /** Cor RGB usada para acender a borda no hover (fallback: glowColor). */
  accentBorder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springConfig = { stiffness: 220, damping: 20, mass: 0.6 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);
  const rotateX = useTransform(springY, [0, 1], [7, -7]);
  const rotateY = useTransform(springX, [0, 1], [-7, 7]);
  const glowX = useTransform(springX, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(springY, [0, 1], ["0%", "100%"]);
  const glowBackground = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(${glowColor},0.18), transparent 60%)`);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
    ref.current!.style.borderColor = `rgba(${accentBorder ?? glowColor},0.35)`;
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
    if (ref.current) ref.current.style.borderColor = "";
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
      whileHover={{ y: -6, boxShadow: "0 30px 60px -12px rgba(0,0,0,0.7)" }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      style={{ rotateX: reduceMotion ? 0 : rotateX, rotateY: reduceMotion ? 0 : rotateY, transformStyle: "preserve-3d" }}
      className={className}
    >
      {!reduceMotion && (
        <motion.div
          className="pointer-events-none absolute -inset-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: glowBackground }}
        />
      )}
      {children}
    </motion.div>
  );
}

const ORDEM_MESES: Record<string, number> = {
  Janeiro: 1, Fevereiro: 2, Março: 3, Abril: 4, Maio: 5, Junho: 6,
  Julho: 7, Agosto: 8, Setembro: 9, Outubro: 10, Novembro: 11, Dezembro: 12,
};

// Partículas do fundo vivo — posições fixas em % + timing variado (evita padrão robótico).
const PARTICULAS_FUNDO = [
  { x: 6, y: 18, duracao: 5.8, delay: 0 },
  { x: 90, y: 10, duracao: 6.4, delay: 0.6 },
  { x: 14, y: 68, duracao: 6.0, delay: 1.3 },
  { x: 94, y: 58, duracao: 6.8, delay: 0.3 },
  { x: 40, y: 88, duracao: 5.4, delay: 1.9 },
  { x: 72, y: 26, duracao: 6.2, delay: 2.1 },
  { x: 25, y: 42, duracao: 5.7, delay: 0.9 },
  { x: 60, y: 72, duracao: 6.6, delay: 1.5 },
] as const;

/** Gera um campo de "estrelas" determinístico (sem Math.random no render — evita mismatch de hidratação). */
function gerarEstrelas(qtd: number, seedBase: number): { x: number; y: number; size: number; opacidade: number }[] {
  const estrelas = [];
  for (let i = 0; i < qtd; i++) {
    const seed = (i + 1) * seedBase;
    const pseudoRand = (n: number) => Math.abs(Math.sin(n) * 10000) % 1;
    estrelas.push({
      x: pseudoRand(seed) * 100,
      y: pseudoRand(seed + 1) * 100,
      size: 1 + pseudoRand(seed + 2) * 1.5,
      opacidade: 0.25 + pseudoRand(seed + 3) * 0.5,
    });
  }
  return estrelas;
}

const ESTRELAS_LONGE = gerarEstrelas(50, 12.9898);
const ESTRELAS_PERTO = gerarEstrelas(28, 78.233);

function formatarPeriodos(periodos: PeriodoComBancos[]): string | null {
  if (!periodos || periodos.length === 0) return null;

  const grupos: Record<string, string[]> = {};
  periodos.forEach((p) => {
    if (!grupos[p.ano]) grupos[p.ano] = [];
    const mesAbv = p.mes.substring(0, 3).toLowerCase();
    if (!grupos[p.ano].includes(mesAbv)) grupos[p.ano].push(mesAbv);
  });

  return Object.keys(grupos)
    .sort((a, b) => Number(b) - Number(a))
    .map((ano) => {
      const mesesOrdenados = grupos[ano].sort((a, b) => {
        const nomeA = Object.keys(ORDEM_MESES).find((m) => m.toLowerCase().startsWith(a)) || "";
        const nomeB = Object.keys(ORDEM_MESES).find((m) => m.toLowerCase().startsWith(b)) || "";
        return ORDEM_MESES[nomeA] - ORDEM_MESES[nomeB];
      });
      return `${mesesOrdenados.join("/")} - ${ano}`;
    })
    .join(" | ");
}

export function ExtratosListagem({ temaName = "blue" }: { temaName?: string }) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const reduceMotion = useReducedMotion();
  // Parallax de profundidade (estilo espaço sideral): camadas de estrelas em
  // profundidades diferentes reagem à posição do mouse em velocidades distintas,
  // reforçando a sensação de 3D sem depender só do shader.
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);
  const parallaxSpring = { stiffness: 40, damping: 14, mass: 1 };
  const parallaxLongeX = useSpring(useTransform(parallaxX, [0, 1], ["6px", "-6px"]), parallaxSpring);
  const parallaxLongeY = useSpring(useTransform(parallaxY, [0, 1], ["6px", "-6px"]), parallaxSpring);
  const parallaxPertoX = useSpring(useTransform(parallaxX, [0, 1], ["18px", "-18px"]), parallaxSpring);
  const parallaxPertoY = useSpring(useTransform(parallaxY, [0, 1], ["18px", "-18px"]), parallaxSpring);
  const [extratos, setExtratos] = useState<ExtratoEmpresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [total, setTotal] = useState(0);
  const [modalNovaEmpresaAberto, setModalNovaEmpresaAberto] = useState(false);
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [empresaPreview, setEmpresaPreview] = useState<ExtratoEmpresa | null>(null);
  const [linhasPreview, setLinhasPreview] = useState<TransacaoParaExportar[]>([]);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoChave>("recente");
  const [analistaFiltro, setAnalistaFiltro] = useState<string | null>(null);
  const [menuOrdenacaoAberto, setMenuOrdenacaoAberto] = useState(false);
  const [menuAnalistaAberto, setMenuAnalistaAberto] = useState(false);
  const [fotosPorNome, setFotosPorNome] = useState<Record<string, string | null>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusca(buscaInput), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaInput]);

  useEffect(() => {
    if (reduceMotion) return;
    const handlePointerMove = (e: PointerEvent) => {
      parallaxX.set(e.clientX / window.innerWidth);
      parallaxY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    getUsers().then((users) => {
      const mapa: Record<string, string | null> = {};
      users.forEach((u) => {
        if (u.nome) mapa[u.nome] = u.imagemUrl ?? null;
      });
      setFotosPorNome(mapa);
    });
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await ListarExtratos({ busca, pageSize: 50 });
      if (res.success && Array.isArray(res.data)) {
        setExtratos(res.data as unknown as ExtratoEmpresa[]);
        setTotal(res.total ?? res.data.length);
      } else {
        setExtratos([]);
        if (res.error) toast.error(typeof res.error === "string" ? res.error : "Erro ao buscar dados");
      }
    } catch {
      setExtratos([]);
      toast.error("Falha na comunicação com o servidor");
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarDados();
  }, [carregarDados]);

  const totalTransacoes = extratos.reduce(
    (acc, emp) => acc + emp.periodos.reduce((accP, p) => accP + p.bancos.reduce((accB, b) => accB + b.transacoes.length, 0), 0),
    0,
  );
  const totalBancos = extratos.reduce((acc, emp) => acc + emp.periodos.reduce((accP, p) => accP + p.bancos.length, 0), 0);

  const analistas = useMemo(() => {
    const nomes = new Set<string>();
    extratos.forEach((e) => {
      if (e.criadoPorNome) nomes.add(e.criadoPorNome);
    });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [extratos]);

  const extratosExibidos = useMemo(() => {
    let lista = extratos;
    if (analistaFiltro) {
      lista = lista.filter((e) => e.criadoPorNome === analistaFiltro);
    }

    const ordenada = [...lista];
    switch (ordenacao) {
      case "az":
        ordenada.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"));
        break;
      case "za":
        ordenada.sort((a, b) => b.razaoSocial.localeCompare(a.razaoSocial, "pt-BR"));
        break;
      case "antigo":
        ordenada.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "recente":
      default:
        ordenada.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return ordenada;
  }, [extratos, ordenacao, analistaFiltro]);

  const abrirPreview = (empresa: ExtratoEmpresa) => {
    const todasTransacoes: TransacaoParaExportar[] = empresa.periodos.flatMap((p) =>
      p.bancos.flatMap((b) =>
        b.transacoes.map((t) => ({
          mesReferencia: `${p.mes}/${p.ano}`,
          nomeBanco: b.nomeBanco,
          data: t.data ? new Date(t.data).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "DATA INCERTA",
          descricao: t.descricao,
          valor: t.valor,
        })),
      ),
    );

    if (todasTransacoes.length === 0) {
      toast.error("Esta empresa ainda não possui transações processadas.");
      return;
    }

    setLinhasPreview(todasTransacoes);
    setEmpresaPreview(empresa);
    setShowPreview(true);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-slate-200 font-sans pb-20 overflow-hidden">
      {/* Fundo vivo — shader animado (WebGL) + overlay + glows lentos + partículas flutuantes */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {!reduceMotion && (
          <div className="absolute inset-0 opacity-70">
            <AnimatedShaderBackground />
          </div>
        )}

        {/* Campo de estrelas em 2 profundidades — parallax de mouse reforça a
            sensação de espaço/3D (camada distante move pouco, próxima move mais). */}
        <motion.div className="absolute -inset-10" style={{ x: parallaxLongeX, y: parallaxLongeY }}>
          {ESTRELAS_LONGE.map((s, i) => (
            <div
              key={`longe-${i}`}
              className="absolute rounded-full bg-white"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacidade * 0.5 }}
            />
          ))}
        </motion.div>
        <motion.div className="absolute -inset-10" style={{ x: parallaxPertoX, y: parallaxPertoY }}>
          {ESTRELAS_PERTO.map((s, i) => (
            <div
              key={`perto-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${s.x}%`, top: `${s.y}%`, width: s.size * 1.4, height: s.size * 1.4,
                opacity: s.opacidade, boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
              }}
            />
          ))}
        </motion.div>

        <div className="absolute inset-0 bg-[#020617]/60" />
        {/* Vinheta radial — escurece as bordas para dar profundidade tipo "olhar pro espaço" */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 40%, transparent 0%, transparent 35%, rgba(2,6,23,0.7) 100%)" }}
        />
        <motion.div
          className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
          style={{ background: `rgba(${accent},0.16)`, filter: "blur(140px)" }}
          animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-24 w-[500px] h-[500px] rounded-full"
          style={{ background: `rgba(${accent},0.12)`, filter: "blur(130px)" }}
          animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={reduceMotion ? undefined : { duration: 11, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1.2 }}
        />
        {!reduceMotion && PARTICULAS_FUNDO.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: `rgba(${accent},0.5)`, boxShadow: `0 0 8px rgba(${accent},0.5)` }}
            animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: p.duracao, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: p.delay }}
          />
        ))}
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-10 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, rgba(${accent},0.16) 0%, rgba(2,6,23,0.5) 55%, rgba(2,6,23,0.3) 100%)`,
            border: `1px solid rgba(${accent},0.22)`,
          }}
        >
          {/* glow decorativo ambiente — não interfere no dropdown/clique */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]">
            <motion.div
              className="absolute -top-24 -right-16 w-80 h-80 rounded-full"
              style={{ background: `rgba(${accent},0.35)`, filter: "blur(90px)" }}
              animate={reduceMotion ? { opacity: 0.5 } : { opacity: [0.35, 0.55, 0.35], scale: [1, 1.06, 1] }}
              transition={reduceMotion ? undefined : { duration: 7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
            />
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <TrendingUp size={200} aria-hidden="true" />
            </div>
          </div>

          <div className="relative space-y-3">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3 rounded-2xl border"
                style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.2)` }}
                animate={reduceMotion ? undefined : { rotate: [0, -4, 4, 0] }}
                transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
              >
                <FileChartLine className="w-7 h-7" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
                  <span style={{ color: `rgba(${accent},1)` }}>EXTRATOS</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-1 ml-1" style={{ color: `rgba(${accent},0.6)` }}>
                  SISTEMA DE ANÁLISE BANCÁRIA ALPHA
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            <BotaoSpotlight accent={accent} onClick={() => setModalNovaEmpresaAberto(true)}>
              <Plus size={16} strokeWidth={3} aria-hidden="true" /> Iniciar Nova Análise
            </BotaoSpotlight>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Volume de Dados", value: totalTransacoes.toLocaleString("pt-BR"), sub: "Linhas Processadas", icon: Zap, useAccent: true },
            { label: "Fluxo de Extratos", value: totalBancos, sub: "Contas Mapeadas", icon: Landmark, useAccent: true },
            { label: "Base Alpha", value: total, sub: "Empresas Ativas", icon: Building2, color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "16,185,129" },
          ].map((stat) => (
            <div key={stat.label} style={{ perspective: 1000 }}>
              <TiltCard
                glowColor={stat.useAccent ? accent : (stat.glow ?? accent)}
                className="group relative bg-slate-950/70 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between overflow-hidden transition-colors duration-500"
              >
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{stat.label}</p>
                  <p className="text-4xl font-black text-white tracking-tighter">{stat.value}</p>
                  <p className="text-[9px] font-bold text-slate-600 uppercase mt-2 flex items-center gap-1">
                    <span
                      className={`w-1 h-1 rounded-full animate-pulse ${stat.useAccent ? "" : stat.color}`}
                      style={stat.useAccent ? { background: `rgba(${accent},1)` } : undefined}
                    />
                    {stat.sub}
                  </p>
                </div>
                <div
                  className={`relative z-10 p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 ${stat.useAccent ? "" : `${stat.bg} ${stat.color}`}`}
                  style={stat.useAccent ? { background: `rgba(${accent},0.1)`, color: `rgba(${accent},1)` } : undefined}
                >
                  <stat.icon size={28} strokeWidth={2.5} aria-hidden="true" />
                </div>
              </TiltCard>
            </div>
          ))}
        </div>

        <div className="relative z-30 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-950/70 p-4 rounded-3xl border border-white/5 backdrop-blur-2xl">
          <div className="w-full lg:w-96 relative shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="BUSCAR CNPJ OU RAZÃO SOCIAL..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              aria-label="Buscar por CNPJ ou razão social"
              onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px rgba(${accent},0.4)`; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = ""; }}
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-1 lg:justify-end">
            {/* Filtro de ordenação */}
            <div className="relative">
              <button
                onClick={() => { setMenuOrdenacaoAberto((v) => !v); setMenuAnalistaAberto(false); }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${accent},0.3)`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                className="w-full sm:w-auto flex items-center justify-between gap-3 px-5 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {(() => {
                    const atual = OPCOES_ORDENACAO.find((o) => o.valor === ordenacao)!;
                    const Icon = atual.icon;
                    return (<><Icon size={14} style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />{atual.label}</>);
                  })()}
                </span>
                <ChevronDown size={14} className={`text-slate-600 transition-transform ${menuOrdenacaoAberto ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {menuOrdenacaoAberto && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setMenuOrdenacaoAberto(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                    >
                      {OPCOES_ORDENACAO.map((opt) => {
                        const Icon = opt.icon;
                        const ativo = ordenacao === opt.valor;
                        return (
                          <button
                            key={opt.valor}
                            onClick={() => { setOrdenacao(opt.valor); setMenuOrdenacaoAberto(false); }}
                            style={ativo ? { background: `rgba(${accent},0.15)`, color: `rgba(${accent},1)` } : undefined}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${ativo ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                          >
                            <Icon size={14} aria-hidden="true" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Filtro por analista */}
            <div className="relative">
              <button
                onClick={() => { setMenuAnalistaAberto((v) => !v); setMenuOrdenacaoAberto(false); }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${accent},0.3)`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                disabled={analistas.length === 0}
                className="w-full sm:w-auto flex items-center justify-between gap-3 px-5 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate max-w-[160px]">
                  <Filter size={14} style={{ color: `rgba(${accent},1)` }} className="shrink-0" aria-hidden="true" />
                  {analistaFiltro || "Todos os Analistas"}
                </span>
                <ChevronDown size={14} className={`text-slate-600 transition-transform shrink-0 ${menuAnalistaAberto ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {menuAnalistaAberto && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setMenuAnalistaAberto(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[100]"
                    >
                      <button
                        onClick={() => { setAnalistaFiltro(null); setMenuAnalistaAberto(false); }}
                        style={!analistaFiltro ? { background: `rgba(${accent},0.15)`, color: `rgba(${accent},1)` } : undefined}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${!analistaFiltro ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <User size={14} aria-hidden="true" />
                        Todos os Analistas
                      </button>
                      {analistas.map((nome) => {
                        const ativo = analistaFiltro === nome;
                        return (
                          <button
                            key={nome}
                            onClick={() => { setAnalistaFiltro(nome); setMenuAnalistaAberto(false); }}
                            style={ativo ? { background: `rgba(${accent},0.15)`, color: `rgba(${accent},1)` } : undefined}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors truncate cursor-pointer ${ativo ? "" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                          >
                            <span
                              className="h-5 w-5 shrink-0 rounded-lg border flex items-center justify-center text-[9px] font-black"
                              style={{ background: `rgba(${accent},0.1)`, borderColor: `rgba(${accent},0.2)`, color: `rgba(${accent},1)` }}
                            >
                              {nome.charAt(0)}
                            </span>
                            <span className="truncate">{nome}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {analistaFiltro && (
              <button
                onClick={() => setAnalistaFiltro(null)}
                aria-label="Limpar filtro de analista"
                className="flex items-center justify-center gap-2 px-4 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <div className="py-32 text-center animate-pulse font-black text-[10px] uppercase tracking-[0.5em]" style={{ color: `rgba(${accent},1)` }}>
            Sincronizando Base Alpha...
          </div>
        ) : extratosExibidos.length === 0 ? (
          <div className="py-32 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.4em]">
            {extratos.length === 0 ? "Vazio" : "Nenhum resultado para este filtro"}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          >
            {extratosExibidos.map((c) => (
              <motion.div
                key={c.id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                style={{ perspective: 1200 }}
              >
                <TiltCard
                  glowColor={accent}
                  className="group relative h-full flex flex-col bg-slate-950/70 border border-white/5 rounded-[2rem] p-7 overflow-hidden transition-colors duration-300"
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ boxShadow: `0 0 40px rgba(${accent},0.15)` }}
                  />

                  <div className="relative flex items-start justify-between gap-3 mb-5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{fmtDate(c.createdAt)}</span>
                      <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{fmtTime(c.createdAt)}</span>
                    </div>
                    <button
                      onClick={() => abrirPreview(c)}
                      aria-label={`Visualizar transações de ${c.razaoSocial}`}
                      style={{ background: `rgba(${accent},0.1)`, borderColor: `rgba(${accent},0.2)` }}
                      className="cursor-pointer relative flex items-center gap-2 px-3 py-2 border rounded-xl transition-all active:scale-95 shrink-0 hover:opacity-80"
                    >
                      <Eye size={13} strokeWidth={3} style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
                    </button>
                  </div>

                  <motion.div layoutId={`empresa-card-${c.id}`} className="relative flex flex-col gap-1 mb-5">
                    <button
                      onClick={() => router.push(`/PainelAlpha/ExtratosBancarios/${c.id}`)}
                      className="text-left text-lg font-black text-white uppercase leading-tight hover:text-emerald-500 transition-all cursor-pointer line-clamp-2"
                    >
                      {c.razaoSocial}
                    </button>
                    <span className="text-[11px] font-bold text-slate-500 tracking-wider">CNPJ: {formatarCnpj(c.cnpj)}</span>
                    <span className="text-[11px] font-bold text-slate-600 uppercase truncate">{c.nomeFantasia || "Sem Nome Fantasia"}</span>
                  </motion.div>

                  <div className="relative flex flex-wrap items-center gap-2 mb-5">
                    <span className="px-2.5 py-1 bg-slate-800/80 rounded-lg text-[9px] font-black text-slate-400">{c.uf || "UF"}</span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase truncate">{c.municipio || "BRASIL"}</span>
                    <span className="ml-auto px-2.5 py-1 bg-slate-800/80 rounded-lg text-[9px] font-black text-slate-400 uppercase">{c.regimeTributario || "Geral"}</span>
                  </div>

                  <div className="relative mb-5">
                    {c.periodos.length > 0 ? (
                      <span className="inline-block px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                        {formatarPeriodos(c.periodos)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic">Nenhum período</span>
                    )}
                  </div>

                  <div className="relative mt-auto pt-5 border-t border-white/5 flex items-center gap-3">
                    <div
                      className="relative h-9 w-9 rounded-xl border flex items-center justify-center text-[11px] font-black shrink-0 overflow-hidden"
                      style={{ background: `rgba(${accent},0.1)`, borderColor: `rgba(${accent},0.2)`, color: `rgba(${accent},1)` }}
                    >
                      {c.criadoPorNome && fotosPorNome[c.criadoPorNome] ? (
                        <Image
                          src={fotosPorNome[c.criadoPorNome]!}
                          alt={c.criadoPorNome}
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        c.analistaResponsavel?.charAt(0) || c.criadoPorNome?.charAt(0) || <User size={13} aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Analista</p>
                      <p className="text-[12px] font-black uppercase text-slate-300 truncate">{c.criadoPorNome || "Usuário não encontrado"}</p>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <ModalNovaEmpresa isOpen={modalNovaEmpresaAberto} onClose={() => setModalNovaEmpresaAberto(false)} aoSucesso={carregarDados} />

      <AnimatePresence>
        {showPreview && empresaPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4" style={{ perspective: 1200 }}>
            <ModalConferencia
              empresa={empresaPreview}
              linhas={linhasPreview}
              onClose={() => setShowPreview(false)}
              onExport={(dadosFiltrados) => {
                exportarRelatorioExcel(dadosFiltrados, empresaPreview.razaoSocial, empresaPreview.cnpj);
                setShowPreview(false);
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
