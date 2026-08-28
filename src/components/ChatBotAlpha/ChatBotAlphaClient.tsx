'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ObterUrlSistemaChatBot, type SistemaChatBot, type ResultadoUrlChatBot } from '@/actions/ChatBotAlpha';
import { SeletorSistemaChatBot } from './SeletorSistemaChatBot';
import { IframeChatBotAlpha } from './IframeChatBotAlpha';

interface ChatBotAlphaClientProps {
  isAdmin: boolean;
  urlInicial: ResultadoUrlChatBot | null;
}

export default function ChatBotAlphaClient({ isAdmin, urlInicial }: ChatBotAlphaClientProps) {
  const [sistema, setSistema] = useState<SistemaChatBot | null>(isAdmin ? null : 'mailhog');
  const [iframeUrl, setIframeUrl] = useState<string | null>(
    urlInicial?.success ? urlInicial.url : null,
  );
  const [erro, setErro] = useState<string | null>(
    urlInicial && !urlInicial.success ? urlInicial.error : null,
  );
  const [carregando, setCarregando] = useState(false);

  const escolherSistema = async (novoSistema: SistemaChatBot) => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ObterUrlSistemaChatBot(novoSistema);
      if (!resultado.success) {
        setErro(resultado.error);
        return;
      }
      setSistema(novoSistema);
      setIframeUrl(resultado.url);
    } finally {
      setCarregando(false);
    }
  };

  const voltarParaEscolha = () => {
    setSistema(null);
    setIframeUrl(null);
    setErro(null);
  };

  // Não-admin sem sistema escolhido ainda não deveria ocorrer (mailhog é fixo), mas cobre o caso de erro inicial.
  if (!isAdmin && !iframeUrl && !erro) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#020617]">
        <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (isAdmin && !sistema) {
    return <SeletorSistemaChatBot onEscolher={escolherSistema} carregando={carregando} erro={erro} />;
  }

  return (
    <div className="relative w-full h-full flex-1 min-h-0 flex flex-col">
      {isAdmin && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5 bg-[#060c1a]">
          <button
            onClick={voltarParaEscolha}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} />
            Trocar sistema
          </button>
        </div>
      )}
      <IframeChatBotAlpha
        url={iframeUrl}
        erro={erro}
        titulo={sistema ?? 'mailhog'}
        onTentarNovamente={sistema ? () => escolherSistema(sistema) : undefined}
      />
    </div>
  );
}
