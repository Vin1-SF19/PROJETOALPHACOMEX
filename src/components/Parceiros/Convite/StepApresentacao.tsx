"use client";

import { useState } from "react";
import Image from "next/image";
import { Instagram, Globe, Star } from "lucide-react";
import { Campo, inputCls, CardSecao, BotoesNavegacao } from "./shared";

interface Props {
  email: string;
  onChange: (patch: { email?: string }) => void;
  onNext: () => void;
}

export default function StepApresentacao({ email, onChange, onNext }: Props) {
  const [tentouAvancar, setTentouAvancar] = useState(false);

  const emailValido = /\S+@\S+\.\S+/.test(email);

  function handleContinuar() {
    setTentouAvancar(true);
    if (emailValido) onNext();
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      <div className="flex justify-center">
        <Image src="/Logotipo-1.png" alt="Alpha Comex & Compliance" width={200} height={70} priority className="h-auto w-[200px]" />
      </div>

      <header
        className="rounded-3xl p-6 text-center"
        style={{ background: "linear-gradient(135deg, rgba(30,64,175,0.25), rgba(15,23,42,0.7))", border: "1px solid rgba(59,130,246,0.25)" }}
      >
        <h1 className="text-xl font-black text-white">Parceria — Assessoria para Revisão de RADAR de Importação</h1>
      </header>

      <CardSecao>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          O aumento do Radar consiste na estruturação de um processo junto ao e-CAC, cumprindo as exigências
          da Receita Federal conforme a Portaria COANA nº 72 de 2020 e a Instrução Normativa nº 1984 de 2020.
          Após a nova Portaria, vimos a dificuldade dos nossos clientes em obter o tão importante aumento de
          limite e nos especializamos para ajudá-los. Como consequência de um trabalho dedicado, resultado
          também da nossa expertise no mercado, até hoje, 100% dos nossos protocolos assessorados foram deferidos!
        </p>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          A assessoria especializada da nossa equipe, tem respaldo jurídico e contábil, consistindo em orientar
          de forma segura e preventiva os importadores, sob quais documentos deverão apresentar, analisando
          minuciosamente e quando necessário ajustando-os para que estejam em total conformidade com a Portaria
          COANA nº 72/2020. Após a estrutura documentacional, faremos o processo digital via e-CAC com
          acompanhamento diário, até o deferimento do pedido e habilitação da nova modalidade de RADAR no SISCOMEX.
        </p>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          É importante frisar, que em caso de indeferimento/arquivamento do processo pelo fiscal, iniciaremos
          um novo processo imediatamente, sem nenhum custo adicional ao contratante até de fato, obtermos o êxito.
        </p>

        <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
          <a
            href="https://www.consultoriaemcomex.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Globe size={14} /> www.consultoriaemcomex.com.br
          </a>
          <a
            href="https://instagram.com/alpha.comex"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Instagram size={14} /> @alpha.comex
          </a>
          <a
            href="https://www.google.com/search?q=alpha+comex&oq=alpha+comex&aqs=chrome.0.35i39i650j46i67i175i199i650j35i39j0i67i131i433i650j46i67i199i465i650j46i131i175i199i433i512j69i60l2.2127j0j7&sourceid=chrome&ie=UTF-8#lrd=0x94d8cd93993bbd25:0x61a16e0924b68c75,1,,,,"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Star size={14} /> Saiba o que nossos clientes falam sobre nós no Google
          </a>
        </div>

        <p className="text-[13px] text-slate-300 leading-relaxed pt-2 border-t border-white/5">
          Certos de que firmaremos uma excelente e lucrativa parceria, nos colocamos à disposição para reuniões,
          treinamentos com o time e todo auxílio que se faça necessário durante a tratativa de negociação.
        </p>
      </CardSecao>

      <CardSecao>
        <h2 className="text-[13px] font-black uppercase tracking-wider text-slate-300">Vamos começar seu cadastro</h2>

        <Campo label="E-mail" obrigatorio dica="Usaremos esse e-mail para enviar suas credenciais de acesso após a aprovação do cadastro.">
          <input
            type="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            className={inputCls}
            placeholder="seu@email.com"
          />
          {tentouAvancar && !emailValido && <p className="text-[11px] text-rose-400 mt-1">Informe um e-mail válido.</p>}
        </Campo>
      </CardSecao>

      <BotoesNavegacao onNext={handleContinuar} />
    </div>
  );
}
