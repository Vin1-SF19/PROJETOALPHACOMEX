"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { CriarAutomacaoBpm, AtualizarAutomacaoBpm } from "@/actions/bpm/Automacoes";
import { salvarAutomacaoBpmSchema } from "@/lib/bpm/automacoes/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AutomacaoBpmView,
  PipelineAutomacaoView,
  TemplateAutomacao,
} from "@/components/bpm/automacoes/types";

type Props = {
  automacao?: AutomacaoBpmView | null;
  pipelineInicialId?: string;
  etapaInicialId?: string;
  pipelines: PipelineAutomacaoView[];
  templates: TemplateAutomacao[];
  onClose: () => void;
  onSaved: () => void;
};

function parametrosIniciais(automacao?: AutomacaoBpmView | null) {
  if (!automacao) return {} as Record<string, unknown>;
  try {
    return JSON.parse(automacao.parametrosJson) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

const labelCls = "mb-1.5 block text-xs font-semibold text-slate-300";
const textareaCls = "min-h-28 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40";

export function AutomacaoFormDialog({
  automacao,
  pipelineInicialId,
  etapaInicialId,
  pipelines,
  templates,
  onClose,
  onSaved,
}: Props) {
  const inicial = parametrosIniciais(automacao);
  const [nome, setNome] = useState(automacao?.nome ?? "");
  const [descricao, setDescricao] = useState(automacao?.descricao ?? "");
  const [pipelineId, setPipelineId] = useState(
    pipelineInicialId ?? pipelines[0]?.id ?? "",
  );
  const [etapaId, setEtapaId] = useState(etapaInicialId ?? "");
  const [gatilhoTipo, setGatilhoTipo] = useState(
    automacao?.gatilhoTipo ?? "ENTRAR_COLUNA",
  );
  const [tempoMinutos, setTempoMinutos] = useState(
    String(automacao?.tempoMinutos ?? 60),
  );
  const [acaoTipo, setAcaoTipo] = useState(automacao?.acaoTipo ?? "ENVIAR_EMAIL");
  const [para, setPara] = useState(String(inicial.para ?? ""));
  const [cc, setCc] = useState(
    Array.isArray(inicial.cc) ? inicial.cc.join(", ") : "",
  );
  const [assunto, setAssunto] = useState(String(inicial.assunto ?? ""));
  const [corpo, setCorpo] = useState(String(inicial.corpo ?? ""));
  const [templateId, setTemplateId] = useState(String(inicial.templateId ?? ""));
  const [tituloContrato, setTituloContrato] = useState(
    String(inicial.titulo ?? "Contrato - {{empresa.razaoSocial}}"),
  );
  const [variaveis, setVariaveis] = useState<Record<string, string>>(() => {
    const valor = inicial.variaveis;
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        item == null ? "" : String(item),
      ]),
    );
  });
  const [isPending, startTransition] = useTransition();

  const pipeline = pipelines.find((item) => item.id === pipelineId);
  const template = templates.find((item) => item.id === templateId);
  const etapaSelecionada = etapaId || pipeline?.etapas[0]?.id || "";

  const parametros = useMemo(() => {
    if (acaoTipo === "ENVIAR_EMAIL") {
      return {
        para,
        assunto,
        corpo,
        cc: cc.split(",").map((item) => item.trim()).filter(Boolean),
      };
    }
    if (acaoTipo === "GERAR_CONTRATO") {
      return { templateId, titulo: tituloContrato, variaveis };
    }
    return {};
  }, [acaoTipo, assunto, cc, corpo, para, templateId, tituloContrato, variaveis]);

  function salvar() {
    const dados = {
      pipelineId,
      etapaId: etapaSelecionada,
      nome,
      descricao: descricao || null,
      gatilhoTipo,
      tempoMinutos: gatilhoTipo === "TEMPO_NA_COLUNA" ? Number(tempoMinutos) : null,
      acaoTipo,
      parametros,
      ativa: automacao?.ativa ?? true,
    };
    const validacao = salvarAutomacaoBpmSchema.safeParse(dados);
    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Revise os dados da automação");
      return;
    }
    startTransition(async () => {
      const resultado = automacao
        ? await AtualizarAutomacaoBpm({ automacaoId: automacao.id, dados: validacao.data })
        : await CriarAutomacaoBpm(validacao.data);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success(automacao ? "Automação atualizada" : "Automação criada");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{automacao ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>
            Configure quando a ação deve entrar na fila e quais dados ela utilizará.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="automacao-nome">Nome</label>
            <Input id="automacao-nome" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Enviar e-mail de boas-vindas" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="automacao-descricao">Descrição opcional</label>
            <Input id="automacao-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Explique o objetivo desta regra" />
          </div>

          <div>
            <span className={labelCls}>Pipeline</span>
            <Select value={pipelineId} onValueChange={(value) => { setPipelineId(value); setEtapaId(""); }}>
              <SelectTrigger aria-label="Selecionar pipeline"><SelectValue placeholder="Pipeline" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Coluna</span>
            <Select value={etapaSelecionada} onValueChange={setEtapaId}>
              <SelectTrigger aria-label="Selecionar coluna"><SelectValue placeholder="Coluna" /></SelectTrigger>
              <SelectContent>
                {(pipeline?.etapas ?? []).map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}{!etapa.ativo ? " (inativa)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className={labelCls}>Quando executar</span>
            <Select value={gatilhoTipo} onValueChange={setGatilhoTipo}>
              <SelectTrigger aria-label="Selecionar gatilho"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRAR_COLUNA">Entrar na coluna</SelectItem>
                <SelectItem value="SAIR_COLUNA">Sair da coluna</SelectItem>
                <SelectItem value="TEMPO_NA_COLUNA">Tempo na coluna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {gatilhoTipo === "TEMPO_NA_COLUNA" && (
            <div>
              <label className={labelCls} htmlFor="automacao-tempo">Minutos na coluna</label>
              <Input id="automacao-tempo" type="number" min={5} max={525600} value={tempoMinutos} onChange={(event) => setTempoMinutos(event.target.value)} />
            </div>
          )}
          <div className={gatilhoTipo === "TEMPO_NA_COLUNA" ? "sm:col-span-2" : ""}>
            <span className={labelCls}>Ação</span>
            <Select value={acaoTipo} onValueChange={setAcaoTipo}>
              <SelectTrigger aria-label="Selecionar ação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ENVIAR_EMAIL">Enviar e-mail</SelectItem>
                <SelectItem value="GERAR_CONTRATO">Gerar contrato</SelectItem>
                <SelectItem value="GERAR_FICHA">Gerar ficha PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Parâmetros da ação</p>
          {acaoTipo === "ENVIAR_EMAIL" && (
            <div className="space-y-3">
              <div><label className={labelCls} htmlFor="automacao-para">Destinatário</label><Input id="automacao-para" type="email" value={para} onChange={(event) => setPara(event.target.value)} placeholder="cliente@empresa.com.br" /></div>
              <div><label className={labelCls} htmlFor="automacao-cc">Cc, separado por vírgulas</label><Input id="automacao-cc" value={cc} onChange={(event) => setCc(event.target.value)} /></div>
              <div><label className={labelCls} htmlFor="automacao-assunto">Assunto</label><Input id="automacao-assunto" value={assunto} onChange={(event) => setAssunto(event.target.value)} placeholder="Atualização de {{empresa.razaoSocial}}" /></div>
              <div><label className={labelCls} htmlFor="automacao-corpo">Mensagem</label><textarea id="automacao-corpo" className={textareaCls} value={corpo} onChange={(event) => setCorpo(event.target.value)} /></div>
            </div>
          )}
          {acaoTipo === "GERAR_CONTRATO" && (
            <div className="space-y-3">
              <div>
                <span className={labelCls}>Template</span>
                <Select value={templateId} onValueChange={(value) => { setTemplateId(value); setVariaveis({}); }}>
                  <SelectTrigger aria-label="Selecionar template de contrato"><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                  <SelectContent>{templates.map((item) => <SelectItem key={item.id} value={item.id}>{item.titulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className={labelCls} htmlFor="automacao-titulo-contrato">Título do documento</label><Input id="automacao-titulo-contrato" value={tituloContrato} onChange={(event) => setTituloContrato(event.target.value)} /></div>
              {template?.variaveis.map((variavel) => (
                <div key={variavel.nome}>
                  <label className={labelCls} htmlFor={`variavel-${variavel.nome}`}>{variavel.label}{variavel.obrigatorio ? " *" : ""}</label>
                  <Input id={`variavel-${variavel.nome}`} value={variaveis[variavel.nome] ?? ""} onChange={(event) => setVariaveis((atual) => ({ ...atual, [variavel.nome]: event.target.value }))} placeholder={variavel.placeholder || `{{empresa.razaoSocial}}`} />
                </div>
              ))}
              {templates.length === 0 && <p className="text-xs text-amber-300">Cadastre um template ativo no Gerador de Documentos.</p>}
            </div>
          )}
          {acaoTipo === "GERAR_FICHA" && (
            <p className="text-sm text-slate-300">A ficha será gerada com o CNPJ e os dados da empresa vinculada ao card e ficará registrada como anexo PDF.</p>
          )}
          <p className="mt-3 text-[11px] text-slate-500">Placeholders: {"{{empresa.razaoSocial}}"}, {"{{empresa.cnpj}}"}, {"{{card.servico}}"}, {"{{responsavel.nome}}"}, {"{{pipeline.nome}}"} e {"{{coluna.nome}}"}.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={salvar} disabled={isPending || !nome.trim() || !pipelineId || !etapaSelecionada}>
            {isPending ? "Salvando..." : "Salvar automação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
