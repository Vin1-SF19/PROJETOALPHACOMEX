"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle, Fingerprint, Mail, Lock, Globe, Zap, ShieldCheck, Check, Settings2, RefreshCw, Key,
} from "lucide-react";
import { toast } from "sonner";
import Form from "next/form";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUTOFILL_PROTECTION_ATTRS } from "@/components/ui/autofill-protection";

import registerAction from "../actions/CreateAction";
import TogglePillCadastro, { AbaAtiva } from "./cadastro/TogglePillCadastro";
import PreviewModulosSetor from "./cadastro/PreviewModulosSetor";
import AbaGestaoEquipe from "./cadastro/AbaGestaoEquipe";
import ModalOnboarding, { type OnboardingTemplate, type NovoUsuario } from "./ModalOnboarding";
import { isAdminRole } from "@/lib/roles";

function gerarSenhaSegura(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  const array = new Uint8Array(12);
  window.crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export default function CadastroUsuarios({
  currentUserRole = "Admin",
  setores = [],
  templates = [],
}: {
  currentUserRole?: string;
  setores?: string[];
  templates?: OnboardingTemplate[];
}) {
  const isAdmin = isAdminRole(currentUserRole);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerAction, null);
  const [aba, setAba] = useState<AbaAtiva>(isAdmin ? "cadastro" : "equipe");
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [callixHabilitado, setCallixHabilitado] = useState(false);
  const [callixUserId, setCallixUserId] = useState("");
  const [senhaCapturada, setSenhaCapturada] = useState("");
  const [modalOnboarding, setModalOnboarding] = useState(false);
  const [usuarioOnboarding, setUsuarioOnboarding] = useState<NovoUsuario | null>(null);

  useEffect(() => {
    if (state) {
      if (state.success) {
        toast.success(state.message || "Acesso Alpha Criado");
        if (state.novoUsuario) {
          setUsuarioOnboarding(state.novoUsuario);
          setModalOnboarding(true);
        }
      } else {
        toast.error(state.message || "Falha no Protocolo");
      }
    }
  }, [state]);

  const handleFecharModal = () => {
    setModalOnboarding(false);
    setSenhaCapturada("");
    setUsuarioOnboarding(null);
  };

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col relative">

      {/* BG glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/8 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-600/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex items-center justify-between border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic text-white">
              SISTEMA <span className="text-indigo-400">ALPHA</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Globe size={10} className="text-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Network: Online</span>
            </div>
          </div>
        </div>

        {isAdmin && <TogglePillCadastro value={aba} onChange={setAba} />}
      </nav>

      {/* Content */}
      <div className="relative z-10 flex-1 p-6 lg:p-10">
        <AnimatePresence mode="wait">

          {/* ─── ABA CADASTRAR NOVO ─────────────────────────────────────── */}
          {aba === "cadastro" && isAdmin && (
            <motion.div
              key="cadastro"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-slate-900/5 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/10">
                <header className="p-8 border-b border-white/5 bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 shadow-lg">
                      <Fingerprint className="text-indigo-400" size={22} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">
                        Provisionar <span className="text-indigo-400">Acesso</span>
                      </h2>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mt-0.5 italic">
                        Protocolo de Segurança Alpha
                      </p>
                    </div>
                  </div>
                </header>

                <div className="p-8 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-indigo-900/5 via-transparent to-transparent">
                  <Form
                    action={formAction}
                    autoComplete="off"
                    {...AUTOFILL_PROTECTION_ATTRS}
                    className="space-y-5"
                  >

                    {/* Nome */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Identificação Nominal</Label>
                      <div className="relative group">
                        <Input name="nome" autoComplete="off" {...AUTOFILL_PROTECTION_ATTRS} placeholder="NOME DO OPERADOR" className="h-13 bg-black/40 border-white/5 rounded-2xl pl-12 text-xs font-bold uppercase tracking-widest focus:border-indigo-500/50 transition-all" required />
                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      </div>
                    </div>

                    {/* Usuario + Senha */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Username</Label>
                        <Input name="usuario" autoComplete="off" {...AUTOFILL_PROTECTION_ATTRS} placeholder="@user" className="h-13 bg-black/40 border-white/5 rounded-2xl text-xs font-bold uppercase focus:border-indigo-500/50" required />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Master Key</Label>
                          <button
                            type="button"
                            onClick={() => setSenhaCapturada(gerarSenhaSegura())}
                            className="flex items-center gap-1 text-[8px] font-black uppercase text-indigo-500 hover:text-indigo-400 transition-colors tracking-widest"
                          >
                            <RefreshCw size={9} />
                            Gerar
                          </button>
                        </div>
                        <div className="relative group">
                          <Input
                            name="senha"
                            autoComplete="new-password"
                            {...AUTOFILL_PROTECTION_ATTRS}
                            type="text"
                            placeholder="••••••••"
                            value={senhaCapturada}
                            onChange={(e) => setSenhaCapturada(e.target.value)}
                            className="h-13 bg-black/40 border-white/5 rounded-2xl pl-10 focus:border-indigo-500/50 font-mono text-sm"
                            required
                          />
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Terminal de E-mail</Label>
                      <div className="relative group">
                        <Input name="email" type="email" autoComplete="off" {...AUTOFILL_PROTECTION_ATTRS} placeholder="operador@alphasystems.com" className="h-13 bg-black/40 border-white/5 rounded-2xl pl-12 text-xs font-bold focus:border-indigo-500/50 transition-all" required />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      </div>
                    </div>

                    {/* Token Onyx (opcional) */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest flex items-center gap-1.5">
                        Token Onyx <span className="text-slate-600 normal-case font-bold tracking-normal">(opcional)</span>
                      </Label>
                      <div className="relative group">
                        <Input name="token_onyx" type="password" autoComplete="one-time-code" {...AUTOFILL_PROTECTION_ATTRS} placeholder="onyx_pat_… — pode preencher depois" className="h-13 bg-black/40 border-white/5 rounded-2xl pl-12 text-xs font-bold focus:border-indigo-500/50 transition-all" />
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      </div>
                      <p className="text-[8px] text-slate-600 leading-relaxed ml-1">
                        PAT individual do usuário no Onyx. Se informado, as conversas com agentes usam a identidade dele; senão, usa a conta de serviço.
                      </p>
                    </div>

                    {/* Hierarquia / Setor */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between ml-1">
                        <Label className="text-[10px] font-black uppercase text-amber-500 tracking-widest italic flex items-center gap-2">
                          <ShieldCheck size={13} /> Hierarquia Operacional
                        </Label>
                        <button
                          type="button"
                          onClick={() => router.push("/PainelAlpha/GestaoSetores")}
                          className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-500 hover:text-indigo-400 transition-colors tracking-widest"
                        >
                          <Settings2 size={10} />
                          Gerenciar
                        </button>
                      </div>
                      <Select
                        name="role"
                        defaultValue=""
                        onValueChange={(val) => setSetorSelecionado(val)}
                      >
                        <SelectTrigger className="h-13 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:border-indigo-500/50">
                          <SelectValue placeholder="Definir Setor / Nível" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-white/10 text-white rounded-xl">
                          {setores.map((s) => (
                            <SelectItem key={s} value={s} className="text-[10px] font-black uppercase py-3 focus:bg-indigo-600 focus:text-white">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview módulos do setor */}
                    {setorSelecionado && (
                      <PreviewModulosSetor setor={setorSelecionado} />
                    )}

                    {setorSelecionado === "COMERCIAL" && (
                      <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <input type="hidden" name="callixHabilitado" value={callixHabilitado ? "on" : ""} />
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <Label htmlFor="callixHabilitado" className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                              Utiliza Callix
                            </Label>
                            <p className="mt-1 text-[9px] text-slate-500">Habilita ligações pelo ServiceHub.</p>
                          </div>
                          <button
                            id="callixHabilitado"
                            type="button"
                            role="switch"
                            aria-checked={callixHabilitado}
                            onClick={() => setCallixHabilitado((atual) => !atual)}
                            className={`relative h-7 w-12 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                              callixHabilitado ? "border-emerald-300/50 bg-emerald-400/30" : "border-white/10 bg-black/30"
                            }`}
                          >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${callixHabilitado ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </div>
                        {callixHabilitado && (
                          <div className="space-y-2 border-t border-emerald-400/10 pt-3">
                            <Label htmlFor="callixUserId" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              ID do agente na Callix
                            </Label>
                            <Input
                              id="callixUserId"
                              name="callixUserId"
                              value={callixUserId}
                              onChange={(event) => setCallixUserId(event.target.value)}
                              placeholder="Ex.: 5"
                              className="h-11 bg-black/40 border-white/5 rounded-xl text-xs font-bold focus:border-emerald-400/50"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Info sobre módulos */}
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                      <Zap size={12} className="text-indigo-400 mt-0.5 shrink-0" />
                      <p className="text-[8px] text-slate-500 leading-relaxed">
                        Módulos herdados automaticamente pelo setor. Para customizar permissões individuais, use <span className="text-indigo-400 font-black">Gestão de Equipe</span>.
                      </p>
                    </div>

                    <Button type="submit" disabled={isPending} className="cursor-pointer w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl shadow-indigo-900/30 transition-all active:scale-95">
                      {isPending ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <Check size={14} />
                          Gerar Acesso
                        </span>
                      )}
                    </Button>
                  </Form>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ABA GESTÃO DE EQUIPE ───────────────────────────────────── */}
          {aba === "equipe" && (
            <motion.div
              key="equipe"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <AbaGestaoEquipe currentUserRole={currentUserRole} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Modal de onboarding — abre automaticamente após criar usuário */}
      <ModalOnboarding
        open={modalOnboarding}
        onClose={handleFecharModal}
        usuario={usuarioOnboarding}
        senhaTemporaria={senhaCapturada}
        templates={templates}
      />
    </main>
  );
}
