import { KeyRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SmbIdentityGate({ admin, onRetry }: { admin: boolean; onRetry: () => void }) {

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" aria-labelledby="smb-link-title">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
          <div>
            <h1 id="smb-link-title" className="font-semibold">Conta QNAP ainda não vinculada</h1>
            <p className="text-sm text-muted-foreground">O vínculo é feito uma única vez por um administrador autorizado.</p>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Depois do cadastro, o Explorer usa automaticamente as permissões reais da sua conta QNAP sem solicitar sua senha.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>Verificar novamente</Button>
          {admin && <Button asChild><Link href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap">Administrar vínculos</Link></Button>}
        </div>
      </section>
    </main>
  );
}
