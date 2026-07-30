"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  DollarSign,
  Scale,
  ShieldAlert,
  CalendarDays,
  Users,
  Package,
  Cable,
  FileDown,
  Lock,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AbaCargos } from "./AbaCargos";
import { AbaTarifarios } from "./AbaTarifarios";
import { ConstrutorRegras } from "./ConstrutorRegras";
import { AbaExcecoes } from "./AbaExcecoes";
import { AbaIntegracoes } from "./AbaIntegracoes";
import { AbaEspelhos } from "./AbaEspelhos";
import { AbaCalendarios } from "./AbaCalendarios";
import { AbaColaboradores } from "./AbaColaboradores";
import { AbaServicos } from "./AbaServicos";
import { AbaPermissoes } from "./AbaPermissoes";
import { ListarSetores } from "@/actions/CommissionPositions";

type SecaoConfig =
  | "cargos"
  | "tarifarios"
  | "regras"
  | "excecoes"
  | "calendarios"
  | "colaboradores"
  | "servicos"
  | "integracoes"
  | "espelhos"
  | "permissoes";

const SECOES: Array<{ id: SecaoConfig; titulo: string; desc: string; icone: typeof Briefcase }> = [
  { id: "cargos", titulo: "Cargos", desc: "Cargos, setor, vínculo padrão e natureza de recebimento.", icone: Briefcase },
  { id: "tarifarios", titulo: "Tarifários", desc: "Preço por serviço e período de vigência.", icone: DollarSign },
  { id: "regras", titulo: "Regras", desc: "Construtor de regras de comissão/prêmio/DSR.", icone: Scale },
  { id: "excecoes", titulo: "Exceções", desc: "Bloqueios, substituições e exceções por colaborador/cargo/cliente.", icone: ShieldAlert },
  { id: "calendarios", titulo: "Calendários", desc: "Feriados estaduais/municipais (nacionais são automáticos).", icone: CalendarDays },
  { id: "colaboradores", titulo: "Colaboradores", desc: "Consulta de cargo/setor/vínculo por colaborador.", icone: Users },
  { id: "servicos", titulo: "Serviços", desc: "Catálogo de serviços e cobertura de tarifário.", icone: Package },
  { id: "integracoes", titulo: "Integrações", desc: "Histórico de sincronizações com CS&NPS/Metas.", icone: Cable },
  { id: "espelhos", titulo: "Espelhos", desc: "Histórico de espelhos já exportados.", icone: FileDown },
  { id: "permissoes", titulo: "Permissões", desc: "RBAC granular por categoria de ação.", icone: Lock },
];

/**
 * Cada seção abre em um MODAL sob demanda (nunca todas montadas juntas) — corrige o
 * problema de lentidão relatado pelo usuário: o padrão anterior de Tabs montava as 10
 * abas simultaneamente na primeira renderização, disparando ~10 fetches de uma vez.
 * Segue o mesmo padrão de modal usado no Checklist RADAR (referência pedida pelo usuário).
 * Busca os setores sozinho (via ListarSetores) para poder ser montado sem navegação de
 * página — usado dentro de um Dialog no próprio dashboard.
 */
export function ConfiguracoesComissoes() {
  const [secaoAberta, setSecaoAberta] = useState<SecaoConfig | null>(null);
  const [setores, setSetores] = useState<Array<{ id: number; nome: string }>>([]);
  const [carregandoSetores, setCarregandoSetores] = useState(true);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const resultado = await ListarSetores();
      if (cancelado) return;
      if (resultado.success) setSetores(resultado.data);
      setCarregandoSetores(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="text-slate-200">
      <p className="text-sm text-slate-400">
        Cargos, tarifários, regras e demais configurações do módulo de Comissões e Prêmios.
      </p>

      {carregandoSetores ? (
        <div className="mt-8 flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : (
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((secao) => {
          const Icone = secao.icone;
          return (
            <button
              key={secao.id}
              type="button"
              onClick={() => setSecaoAberta(secao.id)}
              className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-left transition-colors hover:border-white/10 hover:bg-slate-900/60"
            >
              <Icone className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-white">{secao.titulo}</p>
                <p className="mt-0.5 text-xs text-slate-500">{secao.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      )}

      <Dialog open={secaoAberta !== null} onOpenChange={(open) => !open && setSecaoAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-slate-200">
              {SECOES.find((s) => s.id === secaoAberta)?.titulo}
            </DialogTitle>
          </DialogHeader>

          {secaoAberta === "cargos" && <AbaCargos setores={setores} />}
          {secaoAberta === "tarifarios" && <AbaTarifarios />}
          {secaoAberta === "regras" && <ConstrutorRegras />}
          {secaoAberta === "excecoes" && <AbaExcecoes />}
          {secaoAberta === "calendarios" && <AbaCalendarios />}
          {secaoAberta === "colaboradores" && <AbaColaboradores />}
          {secaoAberta === "servicos" && <AbaServicos />}
          {secaoAberta === "integracoes" && <AbaIntegracoes />}
          {secaoAberta === "espelhos" && <AbaEspelhos />}
          {secaoAberta === "permissoes" && <AbaPermissoes />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
