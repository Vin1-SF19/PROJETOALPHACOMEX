"use client";

import { Lock, KeyRound, LoaderCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { alterarSenhaPropriaAction } from "@/actions/perfil";
import { logout } from "@/actions/logout";
import { useFormStatus } from "react-dom";


export function FormSenha() {
    async function handleAction(formData: FormData) {
        const toastId = toast.loading("Sincronizando novas chaves...");

        const res = await alterarSenhaPropriaAction(formData);

        if (!res.success) {
            toast.error(res.error, { id: toastId });
        } else {
            toast.success("Senha alterada! Desconectando para validar...", { id: toastId });

            setTimeout(async () => {
                await logout();
            }, 2000);
        }
    }

    function BotaoSubmit() {
        const { pending } = useFormStatus();

        return (
            <Button
                type="submit"
                disabled={pending}
                className="cursor-pointer h-12 px-10 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl transition-all disabled:opacity-50"
            >
                {pending ? (
                    <div className="flex items-center gap-2">
                        <LoaderCircle className="animate-spin" size={16} />
                        Sincronizando...
                    </div>
                ) : (
                    "Atualizar Protocolo de Segurança"
                )}
            </Button>
        );
    }

    return (
        <form action={handleAction} id="form-seguranca" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Senha Atual</Label>
                <div className="relative">
                    <Input name="senhaAtual" autoComplete="new-password" type="password" required placeholder="••••••••" className="h-12 bg-black/40 border-white/5 rounded-2xl pl-10 text-xs focus:ring-amber-500/20" />
                    <Lock className="absolute left-3 top-3.5 text-slate-600" size={14} />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Nova Credencial</Label>
                <div className="relative">
                    <Input name="novaSenha" type="password" required placeholder="••••••••" className="h-12 bg-black/40 border-white/5 rounded-2xl pl-10 text-xs focus:ring-amber-500/20" />
                    <KeyRound className="absolute left-3 top-3.5 text-slate-600" size={14} />
                </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-16">
                <BotaoSubmit/>
            </div>
        </form>
    );
}
