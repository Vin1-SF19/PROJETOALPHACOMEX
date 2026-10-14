"use client";

import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";

export const BUILDER_URL = "/api/chatbotx/open";
export const BUILDER_LOAD_TIMEOUT_MS = 30_000;

export function BuilderClient() {
  return <BuilderFrame />;
}

function BuilderFrame() {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("error"), BUILDER_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const onOffline = () => setStatus("error");
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) onOffline();
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" aria-label="ChatbotX">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden" aria-busy={status === "loading"}>
        {status === "loading" && (
          <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-background p-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Carregando ChatbotX…
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-background p-6 text-center">
            <WifiOff className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold">Não foi possível carregar o ChatbotX</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              A conexão pode ter falhado, o tempo de espera terminou ou a aplicação externa bloqueou o carregamento. Recarregue a página para tentar novamente.
            </p>
          </div>
        )}
        {status !== "error" && (
          <iframe
            src={BUILDER_URL}
            title="ChatbotX — aplicação externa"
            className="h-full w-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setStatus(current => current === "loading" ? "loaded" : current)}
            onError={() => setStatus("error")}
          />
        )}
      </div>
    </section>
  );
}
