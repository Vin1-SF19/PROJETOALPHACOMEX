import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { Shield, AlertTriangle } from "lucide-react";
import MudarSenhaForm from "@/components/mudar-senha/MudarSenhaForm";

export default async function MudarSenhaPage() {
  const session = await auth();

  if (!session) redirect("/");

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      {/* BG glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[50%] h-[40%] bg-indigo-600/6 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/5 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/10">

          {/* Header */}
          <header className="p-8 border-b border-white/5 bg-gradient-to-b from-indigo-600/8 to-transparent">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
                <Shield className="text-indigo-400" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black text-white uppercase tracking-tighter italic">
                  Primeiro <span className="text-indigo-400">Acesso</span>
                </h1>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mt-0.5">
                  Painel Alpha — Segurança
                </p>
              </div>
            </div>
          </header>

          <div className="p-8 space-y-6">
            {/* Aviso */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1">
                  Senha Temporária Detectada
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Por segurança, você precisa criar sua senha pessoal antes de acessar o sistema.
                  A senha temporária será invalidada.
                </p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-bold text-white">
                Olá, <span className="text-indigo-400">{session.user.nome ?? session.user.email}</span>!
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Defina sua senha pessoal para continuar.
              </p>
            </div>

            <MudarSenhaForm />
          </div>
        </div>
      </div>
    </main>
  );
}
