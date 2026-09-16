import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface OperationalStateProps { state: "loading" | "error" | "empty"; title?: string; description?: string; onRetry?: () => void }
export function OperationalState({ state, title, description, onRetry }: OperationalStateProps) {
  if (state === "loading") return <div className="space-y-2 p-4" role="status" aria-label="Carregando"><Skeleton className="h-14 w-full bg-white/5" /><Skeleton className="h-14 w-full bg-white/5" /><Skeleton className="h-14 w-4/5 bg-white/5" /></div>;
  const Icon = state === "error" ? AlertCircle : Inbox;
  return <div className="grid min-h-48 place-items-center p-6 text-center" role={state === "error" ? "alert" : "status"}><div><Icon className="mx-auto mb-3 size-8 text-slate-600" /><p className="text-sm font-medium text-slate-300">{title ?? (state === "error" ? "Não foi possível carregar" : "Nenhum item encontrado")}</p>{description && <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>}{state === "error" && onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Tentar novamente</Button>}</div></div>;
}
