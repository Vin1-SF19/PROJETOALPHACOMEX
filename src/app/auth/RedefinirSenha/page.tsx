"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { redefinirSenha } from "@/actions/RecuperarSenha";
import { toast } from "sonner";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

function FormularioRedefinir() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");
    
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token) {
            return toast.error("Token de recuperação ausente!");
        }

        if (novaSenha !== confirmarSenha) {
            return toast.error("As senhas não coincidem!");
        }

        if (novaSenha.length < PASSWORD_MIN_LENGTH || novaSenha.length > PASSWORD_MAX_LENGTH) {
            return toast.error(`A senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`);
        }

        const res = await redefinirSenha(token, novaSenha);

        if (res.success) {
            toast.success("Senha atualizada! Redirecionando...");
            setTimeout(() => router.push("/"), 2000);
        } else {
            toast.error(res.error || "Erro ao redefinir senha.");
        }
    };

    return (
        <form onSubmit={handleReset} className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 w-full max-w-md space-y-6">
            <h1 className="text-white font-black uppercase italic text-xl">
                Nova <span className="text-indigo-500">Senha</span>
            </h1>
            <input 
                type="password" 
                placeholder="NOVA SENHA" 
                value={novaSenha} 
                onChange={e => setNovaSenha(e.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500"
            />
            <input 
                type="password" 
                placeholder="CONFIRMAR NOVA SENHA" 
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500"
            />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-black uppercase rounded-xl">
                Atualizar Senha
            </button>
        </form>
    );
}

export default function PaginaRedefinirSenha() {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <Suspense fallback={<div className="text-white font-black uppercase text-xs animate-pulse">Validando Token...</div>}>
                <FormularioRedefinir />
            </Suspense>
        </div>
    );
}
