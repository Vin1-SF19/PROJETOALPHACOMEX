"use client";

import { useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AtualizarCadenciaBpm,
  AtualizarPassoCadenciaBpm,
  CriarCadenciaBpm,
  CriarPassoCadenciaBpm,
  RemoverPassoCadenciaBpm,
} from "@/actions/bpm/Cadencias";
import { BPM_TAREFA_TIPOS } from "@/lib/bpm/cadencias/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CadenciaView, PipelineCadenciaView } from "@/components/bpm/cadencias/types";

type Props = {
  cadencia?: CadenciaView | null;
  pipelines: PipelineCadenciaView[];
  onClose: () => void;
  onSaved: () => void;
  onCreated?: (cadencia: CadenciaView) => void;
};

const TIPO_LABEL: Record<string, string> = {
  CHECKLIST: "Checklist", LIGACAO: "Ligação", WHATSAPP: "WhatsApp", EMAIL: "E-mail", TAREFA: "Tarefa", LEMBRETE_RAPIDO: "Lembrete rápido",
};

export function CadenciaFormDialog({ cadencia, pipelines, onClose, onSaved, onCreated }: Props) {
  const [nome, setNome] = useState(cadencia?.nome ?? "");
  const [descricao, setDescricao] = useState(cadencia?.descricao ?? "");
  const [pipelineId, setPipelineId] = useState(cadencia?.pipelineId ?? "");
  const [ativa, setAtiva] = useState(cadencia?.ativa ?? true);
  const [passos, setPassos] = useState(cadencia?.passos ?? []);
  const [novoPassoTitulo, setNovoPassoTitulo] = useState("");
  const [novoPassoIntervalo, setNovoPassoIntervalo] = useState("1");
  const [novoPassoTipo, setNovoPassoTipo] = useState("LIGACAO");
  const [salvando, startTransition] = useTransition();

  function salvarMetadados() {
    if (!nome.trim()) {
      toast.error("Informe o nome da cadência.");
      return;
    }
    startTransition(async () => {
      const payload = { nome: nome.trim(), descricao: descricao.trim() || undefined, pipelineId: pipelineId || undefined, ativa };
      const resposta = cadencia
        ? await AtualizarCadenciaBpm({ ...payload, id: cadencia.id })
        : await CriarCadenciaBpm(payload);
      if (!resposta.success || !resposta.data) {
        toast.error(typeof resposta.error === "string" ? resposta.error : "Revise os dados.");
        return;
      }
      if (!cadencia && onCreated) {
        toast.success("Cadência criada — adicione os passos");
        onCreated({ ...resposta.data, passos: [] });
        return;
      }
      toast.success("Cadência atualizada");
      onSaved();
    });
  }

  function adicionarPasso() {
    if (!cadencia) {
      toast.error("Salve a cadência antes de adicionar passos.");
      return;
    }
    if (!novoPassoTitulo.trim()) {
      toast.error("Informe o título do passo.");
      return;
    }
    startTransition(async () => {
      const resposta = await CriarPassoCadenciaBpm({
        cadenciaId: cadencia.id,
        ordem: passos.length + 1,
        intervaloDias: Number(novoPassoIntervalo) || 0,
        tipoTarefa: novoPassoTipo,
        titulo: novoPassoTitulo.trim(),
        prioridade: "NORMAL",
      });
      if (!resposta.success || !resposta.data) {
        toast.error(typeof resposta.error === "string" ? resposta.error : "Erro ao adicionar passo.");
        return;
      }
      toast.success("Passo adicionado");
      setNovoPassoTitulo("");
      setPassos((atual) => [...atual, resposta.data]);
    });
  }

  function alternarPassoAtivo(passoId: string, ativoNovo: boolean) {
    startTransition(async () => {
      const resposta = await AtualizarPassoCadenciaBpm({ id: passoId, ativo: ativoNovo });
      if (!resposta.success) {
        toast.error("Erro ao atualizar passo.");
        return;
      }
      setPassos((atual) => atual.map((p) => (p.id === passoId ? { ...p, ativo: ativoNovo } : p)));
    });
  }

  function removerPasso(passoId: string) {
    startTransition(async () => {
      const resposta = await RemoverPassoCadenciaBpm(passoId);
      if (!resposta.success) {
        toast.error(typeof resposta.error === "string" ? resposta.error : "Erro ao remover passo.");
        return;
      }
      setPassos((atual) => atual.filter((p) => p.id !== passoId));
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cadencia ? "Editar cadência" : "Nova cadência"}</DialogTitle>
          <DialogDescription>Sequência configurável de atividades — ex.: 8 dias de ligação até obter resposta.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input placeholder="Nome (ex.: Lead sem resposta)" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={pipelineId || "TODOS"} onValueChange={(v) => setPipelineId(v === "TODOS" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Pipeline (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Qualquer pipeline</SelectItem>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between rounded-xl border border-white/10 px-3">
              <span className="text-xs text-slate-400">Ativa</span>
              <Switch checked={ativa} onCheckedChange={setAtiva} />
            </div>
          </div>
          <Button onClick={salvarMetadados} disabled={salvando} variant="outline" className="w-full">
            {cadencia ? "Salvar alterações" : "Criar cadência"}
          </Button>

          {cadencia && (
            <div className="space-y-2 rounded-xl border border-white/10 p-3">
              <span className="text-xs font-semibold text-slate-300">Passos ({passos.length})</span>
              {passos.map((passo) => (
                <div key={passo.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs">
                  <GripVertical size={13} className="shrink-0 text-slate-600" />
                  <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Dia {passo.intervaloDias}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{passo.titulo}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{TIPO_LABEL[passo.tipoTarefa] ?? passo.tipoTarefa}</span>
                  <Switch checked={passo.ativo} onCheckedChange={(v) => alternarPassoAtivo(passo.id, v)} />
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-400" onClick={() => removerPasso(passo.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_80px_120px_auto] items-center gap-1.5">
                <Input className="h-8 text-xs" placeholder="Título do passo" value={novoPassoTitulo} onChange={(e) => setNovoPassoTitulo(e.target.value)} />
                <Input className="h-8 text-xs" type="number" placeholder="Dia" value={novoPassoIntervalo} onChange={(e) => setNovoPassoIntervalo(e.target.value)} />
                <Select value={novoPassoTipo} onValueChange={setNovoPassoTipo}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BPM_TAREFA_TIPOS.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={adicionarPasso} disabled={salvando}>
                  <Plus size={13} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
