"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CriarConhecimentoLinkBpm, ExcluirConhecimentoLinkBpm, ListarConhecimentoLinksBpm } from "@/actions/bpm/Conhecimento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Link = { id: string; titulo: string; url: string; descricao: string | null; ordem: number };
type Pipeline = { id: string; nome: string };

export function ConhecimentoWorkspace({ pipelines, accent }: { pipelines: Pipeline[]; accent: string }) {
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [links, setLinks] = useState<Link[]>([]);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, startTransition] = useTransition();

  function recarregar(id: string) {
    ListarConhecimentoLinksBpm(id).then((res) => {
      if (res.success) setLinks(res.data);
    });
  }

  useEffect(() => {
    if (pipelineId) recarregar(pipelineId);
  }, [pipelineId]);

  function adicionar() {
    if (!titulo.trim() || !url.trim()) {
      toast.error("Preencha título e URL.");
      return;
    }
    startTransition(async () => {
      const resposta = await CriarConhecimentoLinkBpm({
        pipelineId,
        titulo: titulo.trim(),
        url: url.trim(),
        descricao: descricao.trim() || undefined,
        ordem: links.length,
      });
      if (!resposta.success) {
        toast.error(resposta.error);
        return;
      }
      toast.success("Link adicionado");
      setTitulo("");
      setUrl("");
      setDescricao("");
      recarregar(pipelineId);
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resposta = await ExcluirConhecimentoLinkBpm({ id });
      if (!resposta.success) {
        toast.error(resposta.error);
        return;
      }
      recarregar(pipelineId);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <BookOpen size={18} style={{ color: `rgb(${accent})` }} />
        <h1 className="text-lg font-bold text-slate-100">Base de Conhecimento por pipeline</h1>
      </div>
      <p className="text-xs text-slate-400">
        Materiais, procedimentos e documentos relevantes de cada pipeline — exibidos no painel do card durante o atendimento.
      </p>

      <Select value={pipelineId} onValueChange={setPipelineId}>
        <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
        <SelectContent>
          {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-slate-200 hover:underline">
              <ExternalLink size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{link.titulo}</span>
            </a>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-rose-400" onClick={() => excluir(link.id)} disabled={salvando}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {links.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhum link cadastrado para este pipeline.</p>}
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 p-3">
        <span className="text-xs font-semibold text-slate-300">Adicionar novo link</span>
        <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Input placeholder="URL (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Input placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Button onClick={adicionar} disabled={salvando || !pipelineId}>
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
