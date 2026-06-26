import { AlertTriangle, Clock, Ban, CheckCircle2 } from "lucide-react";

const MENSAGENS: Record<string, { titulo: string; texto: string; icon: React.ReactNode }> = {
  NAO_ENCONTRADO: {
    titulo: "Convite não encontrado",
    texto: "Este link de convite não existe ou foi digitado incorretamente. Solicite um novo link.",
    icon: <AlertTriangle size={32} className="text-amber-400" />,
  },
  EXPIRADO: {
    titulo: "Convite expirado",
    texto: "O prazo deste convite já passou. Entre em contato com a Alpha Comex para receber um novo link.",
    icon: <Clock size={32} className="text-amber-400" />,
  },
  USADO: {
    titulo: "Convite já utilizado",
    texto: "Este convite já foi preenchido. Se precisar atualizar seus dados, fale com a Alpha Comex.",
    icon: <CheckCircle2 size={32} className="text-emerald-400" />,
  },
  REVOGADO: {
    titulo: "Convite cancelado",
    texto: "Este convite foi cancelado pela Alpha Comex. Solicite um novo link, se necessário.",
    icon: <Ban size={32} className="text-rose-400" />,
  },
};

export default function ConviteInvalido({ motivo }: { motivo: string }) {
  const m = MENSAGENS[motivo] ?? MENSAGENS.NAO_ENCONTRADO;

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "#060c1a" }}>
      <div
        className="w-full max-w-md rounded-3xl p-8 text-center"
        style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center" style={{ background: "rgba(255,255,255,0.04)" }}>
          {m.icon}
        </div>
        <h1 className="text-lg font-black text-white mb-2">{m.titulo}</h1>
        <p className="text-[13px] text-slate-400 leading-relaxed">{m.texto}</p>
      </div>
    </main>
  );
}
