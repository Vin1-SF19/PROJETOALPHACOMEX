import { Children, isValidElement } from "react";
import { motion, useReducedMotion } from "framer-motion";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const AREAS = [
  "Despacho Aduaneiro", "Agenciamento de Cargas", "Contabilidade", "Advocacia",
  "Consultoria Empresarial", "Trade", "Digital Influencer", "Outros",
] as const;

export interface RepresentanteExtra {
  nome: string;
  cpf: string;
  dataNascimento: string;
  cargo: string;
  telefone: string;
}

export interface ConviteFormData {
  pin: string;
  email: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  dadosConsultaCpf: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  areasAtuacao: string[];
  tipoRecebimento: "PF" | "PJ" | "";
  souRepresentante: boolean;
  representantesExtra: RepresentanteExtra[];
  nomeEmpresa: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  dadosConsultaCnpj: string;
  sobre: string;
  termoAceito: boolean;
}

export const CONVITE_FORM_VAZIO: ConviteFormData = {
  pin: "",
  email: "",
  nomeCompleto: "",
  cpf: "",
  dataNascimento: "",
  dadosConsultaCpf: "",
  whatsapp: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  areasAtuacao: [],
  tipoRecebimento: "",
  souRepresentante: true,
  representantesExtra: [],
  nomeEmpresa: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  dadosConsultaCnpj: "",
  sobre: "",
  termoAceito: false,
};

export const inputCls =
  "w-full h-11 px-3 rounded-xl text-[13px] text-white outline-none transition-all bg-black/40 border border-white/10 focus:border-blue-500/50 placeholder:text-slate-600";

export function Campo({
  label,
  obrigatorio,
  dica,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  dica?: string;
  children: React.ReactNode;
}) {
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

const cardContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function CardSecao({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <section
        className="rounded-3xl p-6 space-y-4"
        style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {children}
      </section>
    );
  }

  return (
    <motion.section
      className="rounded-3xl p-6 space-y-4"
      style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}
      initial="hidden"
      animate="show"
      variants={cardContainerVariants}
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? <motion.div variants={cardItemVariants}>{child}</motion.div> : child
      )}
    </motion.section>
  );
}

const glowShadowPulse = [
  "0 8px 20px rgba(37,99,235,0.3)",
  "0 8px 30px rgba(37,99,235,0.5)",
  "0 8px 20px rgba(37,99,235,0.3)",
];

export function BotoesNavegacao({
  onBack,
  onNext,
  labelNext = "Continuar",
  disabledNext,
  loadingNext,
}: {
  onBack?: () => void;
  onNext: () => void;
  labelNext?: string;
  disabledNext?: boolean;
  loadingNext?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-2xl text-[12px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          Voltar
        </button>
      )}
      <motion.button
        type="button"
        onClick={onNext}
        disabled={disabledNext || loadingNext}
        className="flex-1 h-12 rounded-2xl text-white text-[12px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
        animate={reduceMotion ? undefined : { boxShadow: glowShadowPulse }}
        transition={reduceMotion ? undefined : { duration: 2.5, repeat: Infinity, repeatType: "mirror" }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {loadingNext ? "Enviando..." : labelNext}
      </motion.button>
    </div>
  );
}
