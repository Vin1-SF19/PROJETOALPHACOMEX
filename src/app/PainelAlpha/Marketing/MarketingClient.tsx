"use client";

import { useState } from "react";

export default function MarketingClient({ iframeUrl }: { iframeUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full flex-1 min-h-0">
      {!loaded && !error && (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 p-6 bg-[#020617]">
          <div className="h-10 w-1/3 rounded-xl bg-slate-800/60 animate-pulse" />
          <div className="h-6 w-1/2 rounded-lg bg-slate-800/40 animate-pulse" />
          <div className="flex-1 rounded-2xl bg-slate-800/30 animate-pulse mt-4" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#020617] text-slate-400">
          <span className="text-4xl">📡</span>
          <p className="font-black uppercase tracking-widest text-sm">Instagram Studio indisponível</p>
          <p className="text-xs text-slate-600">Verifique se o servidor está online na rede local.</p>
          <p className="text-[10px] text-slate-700 font-mono">{iframeUrl}</p>
          <button
            onClick={() => { setError(false); setLoaded(false); }}
            className="mt-2 px-4 py-2 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-black uppercase tracking-widest hover:bg-pink-600/30 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <iframe
        src={iframeUrl}
        title="Instagram Studio"
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-top-navigation-by-user-activation"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
