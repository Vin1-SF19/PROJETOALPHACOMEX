"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaCargos } from "./AbaCargos";
import { AbaTarifarios } from "./AbaTarifarios";
import { ConstrutorRegras } from "./ConstrutorRegras";

interface ConfiguracoesComissoesProps {
  setores: Array<{ id: number; nome: string }>;
}

/**
 * TODO(expansão futura — seção 26 do prompt original): as abas Colaboradores, Vínculos,
 * Serviços, Exceções, Calendários, Integrações, Espelhos e Permissões ainda não têm
 * backend dedicado nesta fila de fases — ficam como placeholder "em breve".
 */
const ABAS_EM_BREVE = [
  "Colaboradores",
  "Vínculos",
  "Serviços",
  "Exceções",
  "Calendários",
  "Integrações",
  "Espelhos",
  "Permissões",
];

export function ConfiguracoesComissoes({ setores }: ConfiguracoesComissoesProps) {
  return (
    <div className="min-h-screen bg-[#020617] px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <div className="mb-6">
        <Link
          href="/PainelAlpha/Comissoes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para Comissões
        </Link>
      </div>

      <h1 className="text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">
        Configurações
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Cargos, tarifários e regras do módulo de Comissões e Prêmios.
      </p>

      <Tabs defaultValue="cargos" className="mt-8">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="cargos" className="border border-white/10 bg-slate-900/40 data-[state=active]:bg-white/10">
            Cargos
          </TabsTrigger>
          <TabsTrigger value="tarifarios" className="border border-white/10 bg-slate-900/40 data-[state=active]:bg-white/10">
            Tarifários
          </TabsTrigger>
          <TabsTrigger value="regras" className="border border-white/10 bg-slate-900/40 data-[state=active]:bg-white/10">
            Regras
          </TabsTrigger>
          {ABAS_EM_BREVE.map((aba) => (
            <TabsTrigger
              key={aba}
              value={aba}
              className="border border-white/5 bg-slate-900/20 text-slate-600 data-[state=active]:bg-white/5"
            >
              {aba}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cargos" className="mt-6">
          <AbaCargos setores={setores} />
        </TabsContent>

        <TabsContent value="tarifarios" className="mt-6">
          <AbaTarifarios />
        </TabsContent>

        <TabsContent value="regras" className="mt-6">
          <ConstrutorRegras />
        </TabsContent>

        {ABAS_EM_BREVE.map((aba) => (
          <TabsContent key={aba} value={aba} className="mt-6">
            <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-white/5 bg-slate-900/40 py-16 text-slate-500">
              <p>{aba} — em breve.</p>
              <p className="text-xs">Esta seção ainda não tem backend dedicado nesta fase do módulo.</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
