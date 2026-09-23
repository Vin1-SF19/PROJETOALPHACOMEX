"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Building2, MapPin, BadgeDollarSign, CalendarDays, FileText, type LucideIcon } from "lucide-react";

type EmpresaDetalhes = Partial<Record<
  "cnpj" | "situacao" | "razaoSocial" | "nomeFantasia" | "contribuinte" |
  "municipio" | "uf" | "dataConstituicao" | "capitalSocial" |
  "regimeTributario" | "dataSituacao" | "submodalidade" | "data_opcao",
  string | null
>>;

type InfoRowProps = { icon: LucideIcon; label: string; value?: string | null; color?: string };

function InfoRow({ icon: Icon, label, value, color }: InfoRowProps) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-slate-900/50 border border-white/5">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} className={color || "text-blue-500"} />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-bold text-slate-200 leading-tight">
        {value || "Não informado"}
      </p>
    </div>
  );
}

function formatarData(valor?: string | null) {
  if (!valor || valor === "N/A") return "Não informado";
  const data = new Date(valor);
  if (isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function ModalDetalhesEmpresa({ empresa, open, onOpenChange }: {
  empresa: EmpresaDetalhes | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!empresa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-2xl rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="p-8 space-y-6">
          <DialogHeader className="border-b border-white/5 pb-6">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                  DETALHES DO <span className="text-blue-500 text-3xl">CNPJ</span>
                </DialogTitle>
                <p className="text-blue-400 font-mono font-bold mt-1 text-lg">{empresa.cnpj}</p>
              </div>
              <div className={`px-4 py-2 rounded-2xl font-black text-xs border ${
                empresa.situacao?.toUpperCase() === "DEFERIDA" || empresa.situacao?.toUpperCase() === "ATIVO"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {empresa.situacao || "SEM STATUS"}
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
               <InfoRow icon={Building2} label="Razão Social" value={empresa.razaoSocial} />
            </div>
            <InfoRow icon={Building2} label="Nome Fantasia" value={empresa.nomeFantasia} />
            <InfoRow icon={FileText} label="Contribuinte" value={empresa.contribuinte} />
            <InfoRow icon={MapPin} label="Município / UF" value={empresa.municipio ? `${empresa.municipio} - ${empresa.uf}` : ""} />
            
            {/* DATAS FORMATADAS ABAIXO */}
            <InfoRow icon={CalendarDays} label="Data da Constituição" value={formatarData(empresa.dataConstituicao)} />
            <InfoRow icon={BadgeDollarSign} label="Capital Social" value={empresa.capitalSocial} />
            <InfoRow icon={FileText} label="Regime Tributário" value={empresa.regimeTributario} />
            <InfoRow icon={CalendarDays} label="Data Situação Radar" value={formatarData(empresa.dataSituacao)} />
            <InfoRow icon={FileText} label="Submodalidade" value={empresa.submodalidade} />
            <InfoRow icon={CalendarDays} label="Data Simples (Opção)" value={formatarData(empresa.data_opcao)} />
          </div>

          <div className="pt-6">
            <Button 
              onClick={() => onOpenChange(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20"
            >
              FECHAR DETALHES
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
