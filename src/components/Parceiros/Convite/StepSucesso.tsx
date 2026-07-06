import { CheckCircle2 } from "lucide-react";

export default function StepSucesso() {
  return (
    <div className="w-full max-w-md mx-auto rounded-3xl p-8 text-center" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(16,185,129,0.2)" }}>
      <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
      <h1 className="text-lg font-black text-white mb-2">Cadastro enviado!</h1>
      <p className="text-[13px] text-slate-400 leading-relaxed">
        Recebemos seus dados. A equipe da Alpha Comex vai analisar e entrar em contato em breve. Obrigado!
      </p>
    </div>
  );
}
