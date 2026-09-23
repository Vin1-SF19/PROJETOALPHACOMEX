import { auth } from "../../../../../auth";
import { Shield, Mail, Fingerprint, KeyRound, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FormSenha } from "./FormularioSenha/FormSenha";
import { AvatarUpload } from "./FotoPerfil/AvatarUpload";

export default async function PerfilUnificadoPage() {
    const session = await auth();
    const user = session?.user;

    const iniciais = user?.nome?.substring(0, 2).toUpperCase() || "OP";

    return (
        <main className="min-h-screen bg-[#020617] p-4 lg:p-12 flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-600/5 blur-[100px] rounded-full" />

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-slate-900/20 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl ring-1 ring-white/10">
                        
                        <div className="mb-6">
                            <AvatarUpload 
                                inicial={iniciais} 
                                fotoAtual={user?.imagemUrl} 
                                />
                        </div>

                        <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
                            {user?.nome}
                        </h1>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 italic">
                            ID: #{user?.id?.toString().slice(-5)}
                        </p>

                        <div className="w-full mt-8 pt-8 border-t border-white/5 space-y-3">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 rounded-xl border border-white/5">
                                <span className="text-[8px] font-black text-slate-500 uppercase italic">Acesso</span>
                                <span className="text-[10px] font-black text-blue-400 uppercase italic">{user?.role}</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 rounded-xl border border-white/5">
                                <span className="text-[8px] font-black text-slate-500 uppercase italic">Status</span>
                                <span className="text-[10px] font-black text-emerald-500 uppercase italic flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-slate-900/10 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-8 shadow-2xl ring-1 ring-white/5">
                        <h2 className="text-xs font-black text-white uppercase italic mb-8 flex items-center gap-3">
                            <Fingerprint className="text-blue-500" size={18} /> Dossiê Corporativo
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Endereço de E-mail</Label>
                                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-xs font-bold text-slate-300 flex items-center gap-3 italic">
                                    <Mail size={14} className="text-blue-500" /> {user?.email}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Username Alpha</Label>
                                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-xs font-bold text-slate-300 flex items-center gap-3 italic uppercase">
                                    <Lock size={14} className="text-blue-500" /> {user?.usuario || "Não Definido"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <Label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Módulos Autorizados</Label>
                            <div className="flex flex-wrap gap-2 p-4 bg-black/20 rounded-[1.5rem] border border-white/5">
                                {user?.permissoes?.map((p: string) => (
                                    <span key={p} className="px-3 py-1 bg-blue-500/10 border border-blue-500/10 rounded-lg text-[8px] font-black text-blue-400 uppercase tracking-widest italic">{p}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/10 backdrop-blur-3xl border border-amber-500/10 rounded-[3rem] p-8 shadow-2xl ring-1 ring-amber-500/5">
                        <h2 className="text-xs font-black text-amber-500 uppercase italic mb-8 flex items-center gap-3">
                            <KeyRound size={18} /> Sincronizar Nova Master Key
                        </h2>
                        <FormSenha />
                    </div>
                </div>
            </div>
        </main>
    );
}
