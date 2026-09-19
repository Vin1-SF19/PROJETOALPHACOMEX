"use client";

import type { LucideIcon } from "lucide-react";
import {
  Archive, Badge, BookOpen, Box, BriefcaseBusiness, Cable, Car, CircleUserRound,
  ClipboardList, Coffee, Cpu, FileText, Headphones, KeyRound, Laptop, Monitor,
  Mouse, Network, Package, PackageCheck, Phone, Plug, Printer, ScanBarcode,
  Server, Shirt, Smartphone, Tags, Wrench, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const INVENTORY_ICONS: Array<{ name: string; label: string; icon: LucideIcon }> = [
  { name: "Package", label: "Pacote", icon: Package },
  { name: "Box", label: "Caixa", icon: Box },
  { name: "PackageCheck", label: "Kit", icon: PackageCheck },
  { name: "Laptop", label: "Notebook", icon: Laptop },
  { name: "Monitor", label: "Monitor", icon: Monitor },
  { name: "Smartphone", label: "Celular", icon: Smartphone },
  { name: "Phone", label: "Telefone", icon: Phone },
  { name: "Mouse", label: "Mouse", icon: Mouse },
  { name: "Headphones", label: "Headset", icon: Headphones },
  { name: "Cable", label: "Cabo", icon: Cable },
  { name: "Plug", label: "Carregador", icon: Plug },
  { name: "Cpu", label: "Componente", icon: Cpu },
  { name: "Server", label: "Servidor", icon: Server },
  { name: "Network", label: "Rede", icon: Network },
  { name: "Printer", label: "Impressora", icon: Printer },
  { name: "BriefcaseBusiness", label: "Trabalho", icon: BriefcaseBusiness },
  { name: "Shirt", label: "Uniforme", icon: Shirt },
  { name: "Badge", label: "Crachá", icon: Badge },
  { name: "KeyRound", label: "Acesso", icon: KeyRound },
  { name: "Wrench", label: "Ferramenta", icon: Wrench },
  { name: "ClipboardList", label: "Administrativo", icon: ClipboardList },
  { name: "FileText", label: "Documento", icon: FileText },
  { name: "BookOpen", label: "Material", icon: BookOpen },
  { name: "Coffee", label: "Consumo", icon: Coffee },
  { name: "Car", label: "Veículo", icon: Car },
  { name: "ScanBarcode", label: "Patrimônio", icon: ScanBarcode },
  { name: "Tags", label: "Etiqueta", icon: Tags },
  { name: "CircleUserRound", label: "Pessoa", icon: CircleUserRound },
  { name: "Zap", label: "Energia", icon: Zap },
  { name: "Archive", label: "Arquivo", icon: Archive },
];

const iconByName = new Map(INVENTORY_ICONS.map((option) => [option.name, option]));

export function inventoryIcon(name?: string | null): LucideIcon {
  return iconByName.get(name || "")?.icon ?? Package;
}

interface InventoryIconSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InventoryIconSelect({ value, onChange, disabled }: InventoryIconSelectProps) {
  const selected = iconByName.get(value) ?? INVENTORY_ICONS[0];
  const SelectedIcon = selected.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="estoque-secondary h-10 w-full justify-start gap-2 font-normal">
          <SelectedIcon size={17} aria-hidden="true" />
          <span>{selected.label}</span>
          <span className="ml-auto text-[10px] text-slate-500">Trocar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] border-white/10 bg-[#08152a] p-3 text-white">
        <p className="mb-2 text-xs font-medium text-slate-300">Escolha um ícone</p>
        <div className="grid grid-cols-5 gap-2" role="listbox" aria-label="Ícones disponíveis">
          {INVENTORY_ICONS.map((option) => {
            const Icon = option.icon;
            const active = option.name === selected.name;
            return (
              <button
                key={option.name}
                type="button"
                role="option"
                aria-selected={active}
                title={option.label}
                onClick={() => onChange(option.name)}
                className={`grid aspect-square place-items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${active ? "border-blue-400/50 bg-blue-500/20 text-blue-200" : "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-white"}`}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="sr-only">{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
