"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { submeterConvitePublico } from "@/actions/convites-parceiro";
import { ConviteFormData, CONVITE_FORM_VAZIO } from "./shared";
import StepPin from "./StepPin";
import StepApresentacao from "./StepApresentacao";
import StepDadosPessoais from "./StepDadosPessoais";
import StepEndereco from "./StepEndereco";
import StepAreaAtuacao from "./StepAreaAtuacao";
import StepEmpresa from "./StepEmpresa";
import StepTermos from "./StepTermos";
import StepSucesso from "./StepSucesso";

interface Props {
  token: string;
  termo: { versao: string; conteudo: string } | null;
}

const STEPS_LABEL = ["Dados", "Endereço", "Atuação", "Empresa", "Termos"] as const;

export default function ConviteWizard({ token, termo }: Props) {
  const [step, setStep] = useState(-1); // -1=PIN, 0=apresentação, 1..5=steps com stepper, 6=sucesso
  const [direction, setDirection] = useState(1); // 1=avançando, -1=voltando (define o sentido da transição)
  const [form, setForm] = useState<ConviteFormData>(CONVITE_FORM_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const patch = (p: Partial<ConviteFormData>) => setForm((f) => ({ ...f, ...p }));

  function irPara(novoStep: number) {
    setDirection(novoStep > step ? 1 : -1);
    setStep(novoStep);
  }

  const stepperIndex = step - 1; // 0..4 quando step está entre 1 e 5

  async function handleSubmit() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await submeterConvitePublico({
        token,
        email: form.email,
        nomeCompleto: form.nomeCompleto,
        cpf: form.cpf || undefined,
        dataNascimento: form.dataNascimento || undefined,
        dadosConsultaCpf: form.dadosConsultaCpf || undefined,
        uf: form.uf,
        municipio: form.cidade || undefined,
        telefone: form.telefone,
        whatsapp: form.whatsapp || undefined,
        cep: form.cep || undefined,
        logradouro: form.logradouro || undefined,
        numero: form.numero || undefined,
        complemento: form.complemento || undefined,
        bairro: form.bairro || undefined,
        cidade: form.cidade || undefined,
        areasAtuacao: form.areasAtuacao.length > 0 ? form.areasAtuacao : undefined,
        razaoSocial: form.razaoSocial || undefined,
        nomeFantasia: form.nomeFantasia || undefined,
        cnpj: form.cnpj || undefined,
        dadosConsultaCnpj: form.dadosConsultaCnpj || undefined,
        sobre: form.sobre || undefined,
        termoAceito: form.termoAceito as true,
      });
      if (res.success) {
        irPara(6);
      } else {
        setErro(res.error);
      }
    } catch {
      setErro("Falha ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  // Sem termo ativo: a etapa de Termos é pulada — o envio acontece ao concluir a etapa de Empresa.
  function handleConcluirEmpresa() {
    if (termo) {
      irPara(5);
    } else {
      void handleSubmit();
    }
  }

  return (
    <main className="min-h-screen py-8 px-4 relative overflow-hidden" style={{ background: "#020617" }}>
      {/* Glows de fundo — "Radar Vivo" */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: "#2563eb", filter: "blur(150px)" }}
          animate={reduceMotion ? { opacity: 0.6, scale: 1 } : { scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: "#38bdf8", filter: "blur(120px)" }}
          animate={reduceMotion ? { opacity: 0.6, scale: 1 } : { scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="relative z-10">
        {step >= 1 && step <= 5 && (
          <div className="w-full max-w-2xl mx-auto mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              {STEPS_LABEL.map((label, i) => {
                const done = i < stepperIndex;
                const active = i === stepperIndex;
                return (
                  <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <motion.div
                        className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-black"
                        style={{
                          background: done ? "#2563eb" : active ? "#fff" : "rgba(255,255,255,0.05)",
                          color: done ? "#fff" : active ? "#000" : "#475569",
                          border: active ? "3px solid rgba(37,99,235,0.3)" : "1px solid rgba(255,255,255,0.1)",
                        }}
                        animate={{ scale: done ? [1, 1.3, 1] : 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        {done ? <Check size={14} /> : i + 1}
                      </motion.div>
                      <span className={`text-[8px] font-black uppercase tracking-widest text-center ${active ? "text-white" : "text-slate-600"}`}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS_LABEL.length - 1 && (
                      <div className="h-0.5 flex-1 mx-2 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <motion.div
                          className="h-full"
                          style={{ background: "#2563eb", transformOrigin: "left" }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: i < stepperIndex ? 1 : 0 }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {step === -1 && (
              <StepPin
                pin={form.pin}
                onChange={patch}
                onNext={() => irPara(0)}
              />
            )}
            {step === 0 && (
              <StepApresentacao
                email={form.email}
                onChange={patch}
                onNext={() => irPara(1)}
              />
            )}
            {step === 1 && (
              <StepDadosPessoais
                token={token}
                pin={form.pin}
                nomeCompleto={form.nomeCompleto}
                cpf={form.cpf}
                dataNascimento={form.dataNascimento}
                telefone={form.telefone}
                whatsapp={form.whatsapp}
                onChange={patch}
                onBack={() => irPara(0)}
                onNext={() => irPara(2)}
              />
            )}
            {step === 2 && (
              <StepEndereco
                cep={form.cep}
                logradouro={form.logradouro}
                numero={form.numero}
                complemento={form.complemento}
                bairro={form.bairro}
                cidade={form.cidade}
                uf={form.uf}
                onChange={patch}
                onBack={() => irPara(1)}
                onNext={() => irPara(3)}
              />
            )}
            {step === 3 && (
              <StepAreaAtuacao
                areasAtuacao={form.areasAtuacao}
                onChange={patch}
                onBack={() => irPara(2)}
                onNext={() => irPara(4)}
              />
            )}
            {step === 4 && (
              <StepEmpresa
                cnpj={form.cnpj}
                razaoSocial={form.razaoSocial}
                nomeFantasia={form.nomeFantasia}
                sobre={form.sobre}
                onChange={patch}
                onBack={() => irPara(3)}
                onNext={handleConcluirEmpresa}
              />
            )}
            {step === 5 && termo && (
              <StepTermos
                termo={termo}
                aceito={form.termoAceito}
                onChange={patch}
                onBack={() => irPara(4)}
                onSubmit={handleSubmit}
                enviando={enviando}
                erro={erro}
              />
            )}
            {step === 6 && <StepSucesso />}
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-[10px] text-slate-700 pt-8">
          Alpha Comex &amp; Compliance · Nunca compartilhe senhas neste formulário.
        </p>
      </div>
    </main>
  );
}
