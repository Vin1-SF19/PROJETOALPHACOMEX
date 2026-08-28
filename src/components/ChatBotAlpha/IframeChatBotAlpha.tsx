'use client';

import { useState } from 'react';

interface IframeChatBotAlphaProps {
  url: string | null;
  erro: string | null;
  titulo: string;
  onTentarNovamente?: () => void;
}

export function IframeChatBotAlpha({ url, erro, titulo, onTentarNovamente }: IframeChatBotAlphaProps) {
  const [loaded, setLoaded] = useState(false);
  const [falhouCarregar, setFalhouCarregar] = useState(false);

  const temErro = Boolean(erro) || falhouCarregar || !url;

  return (
    <div className="relative w-full h-full flex-1 min-h-0">
      {!loaded && !temErro && (
        <div className="absolute inset-0 z-10 flex flex-col gap-3 p-6 bg-[#020617]">
          <div className="h-10 w-1/3 rounded-xl bg-slate-800/60 animate-pulse" />
          <div className="h-6 w-1/2 rounded-lg bg-slate-800/40 animate-pulse" />
          <div className="flex-1 rounded-2xl bg-slate-800/30 animate-pulse mt-4" />
        </div>
      )}

      {temErro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#020617] text-slate-400">
          <span className="text-4xl">🤖</span>
          <p className="font-black uppercase tracking-widest text-sm">{titulo} indisponível</p>
          <p className="text-xs text-slate-600">{erro ?? 'Verifique se o serviço está online.'}</p>
          {onTentarNovamente && (
            <button
              onClick={() => { setFalhouCarregar(false); setLoaded(false); onTentarNovamente(); }}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-600/30 transition-colors"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {url && (
        <iframe
          src={url}
          title={titulo}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-top-navigation-by-user-activation"
          onLoad={() => setLoaded(true)}
          onError={() => setFalhouCarregar(true)}
        />
      )}
    </div>
  );
}
