"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

export type EnderecoData = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSalvar: (endereco: EnderecoData) => void;
  inicial?: EnderecoData;
};

const EMPTY: EnderecoData = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

export default function ModalEndereco({ open, onClose, onSalvar, inicial }: Props) {
  const [form, setForm] = useState<EnderecoData>(inicial ?? EMPTY);
  const [buscando, setBuscando] = useState(false);

  function set(field: keyof EnderecoData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function buscarCep() {
    const cepLimpo = form.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) { toast.error("CEP deve ter 8 dígitos"); return; }
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d.erro) { toast.error("CEP não encontrado"); return; }
      setForm(prev => ({
        ...prev,
        logradouro: d.logradouro || "",
        bairro: d.bairro || "",
        cidade: d.localidade || "",
        uf: d.uf || "",
      }));
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setBuscando(false);
    }
  }

  function handleSalvar() {
    if (!form.cep || !form.logradouro || !form.bairro || !form.cidade || !form.uf) {
      toast.error("Preencha os campos obrigatórios do endereço");
      return;
    }
    onSalvar(form);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-slate-950 border-white/10 text-slate-200 max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-black uppercase italic tracking-tight">
            <MapPin size={18} className="text-indigo-400" />
            Endereço do Parceiro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* CEP */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">CEP *</Label>
            <div className="flex gap-2">
              <Input
                placeholder="00000-000"
                value={form.cep}
                onChange={e => set("cep", e.target.value)}
                className="bg-black/40 border-white/10 rounded-xl text-sm font-mono"
                maxLength={9}
              />
              <Button
                type="button"
                onClick={buscarCep}
                disabled={buscando}
                className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-3 shrink-0"
              >
                {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>
          </div>

          {/* Logradouro + Número */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Logradouro *</Label>
              <Input value={form.logradouro} onChange={e => set("logradouro", e.target.value)}
                placeholder="Rua / Av." className="bg-black/40 border-white/10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Número</Label>
              <Input value={form.numero} onChange={e => set("numero", e.target.value)}
                placeholder="Nº" className="bg-black/40 border-white/10 rounded-xl text-sm" />
            </div>
          </div>

          {/* Complemento */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Complemento</Label>
            <Input value={form.complemento} onChange={e => set("complemento", e.target.value)}
              placeholder="Apto, sala, bloco..." className="bg-black/40 border-white/10 rounded-xl text-sm" />
          </div>

          {/* Bairro */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bairro *</Label>
            <Input value={form.bairro} onChange={e => set("bairro", e.target.value)}
              className="bg-black/40 border-white/10 rounded-xl text-sm" />
          </div>

          {/* Cidade + UF */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cidade *</Label>
              <Input value={form.cidade} onChange={e => set("cidade", e.target.value)}
                className="bg-black/40 border-white/10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">UF *</Label>
              <Input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase())}
                maxLength={2} className="bg-black/40 border-white/10 rounded-xl text-sm uppercase" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}
              className="flex-1 border border-white/10 rounded-2xl text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSalvar}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-xs">
              Salvar Endereço
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
