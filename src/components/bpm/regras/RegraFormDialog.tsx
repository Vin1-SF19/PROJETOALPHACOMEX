"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AtualizarRegraBpm, CriarRegraBpm } from "@/actions/bpm/Regras";
import { salvarRegraBpmSchema } from "@/lib/bpm/regras/persistencia-schemas";
import {
  CAMPOS_FIXOS_POR_FONTE,
  OPERADORES_REGRAS,
  type CampoReferencia,
  type FonteCampo,
  type GrupoCondicao,
  type OperadorRegra,
  type ResultadoRegra,
} from "@/lib/bpm/regras/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { PipelineRegraView, RegraBpmView } from "@/components/bpm/regras/types";

type Props = {
  regra?: RegraBpmView | null;
  pipelines: PipelineRegraView[];
  onClose: () => void;
  onSaved: () => void;
};

const OPERADOR_LABEL: Record<OperadorRegra, string> = {
  igual: "= igual a", diferente: "≠ diferente de", maior: "> maior que", menor: "< menor que",
  maiorOuIgual: "≥ maior ou igual", menorOuIgual: "≤ menor ou igual",
  preenchido: "está preenchido", vazio: "está vazio",
  contem: "contém", naoContem: "não contém", estaEm: "está em (lista)", naoEstaEm: "não está em (lista)",
  dataAntes: "data antes de", dataDepois: "data depois de",
};

const OPERADORES_SEM_VALOR = new Set<OperadorRegra>(["preenchido", "vazio"]);
const OPERADORES_LISTA = new Set<OperadorRegra>(["estaEm", "naoEstaEm"]);

const FONTES: FonteCampo[] = ["card", "cliente", "processo", "contratacao", "relacionada", "checklist", "campo_dinamico"];
const FONTE_LABEL: Record<FonteCampo, string> = {
  card: "Card", cliente: "Cliente", processo: "Processo", contratacao: "Contratação",
  relacionada: "Entidade relacionada", checklist: "Checklist", campo_dinamico: "Campo dinâmico (CUID)",
};

const RESULTADO_TIPO_LABEL: Record<ResultadoRegra["tipo"], string> = {
  campo_obrigatorio: "Tornar campo(s) obrigatório(s)",
  bloqueio_movimentacao: "Bloquear movimentação",
  mensagem_validacao: "Exibir mensagem de validação",
  calculo: "Executar cálculo",
  formula_segura: "Aplicar fórmula",
  tabela_decisao: "Consultar tabela de decisão (avançado — edite via JSON)",
  resultado_condicional: "Determinar resultado condicional",
};

interface CondicaoLinha {
  fonte: FonteCampo;
  campo: string;
  operador: OperadorRegra;
  valor: string;
}

function campoParaReferencia(fonte: FonteCampo, campo: string): CampoReferencia {
  return { fonte, campo } as CampoReferencia;
}

function linhaParaCondicaoFolha(linha: CondicaoLinha) {
  const base = { tipo: "condicao" as const, campo: campoParaReferencia(linha.fonte, linha.campo), operador: linha.operador };
  if (OPERADORES_SEM_VALOR.has(linha.operador)) return base;
  if (OPERADORES_LISTA.has(linha.operador)) {
    return { ...base, valor: linha.valor.split(",").map((item) => item.trim()).filter(Boolean) };
  }
  const numero = Number(linha.valor);
  const valor = linha.valor.trim() !== "" && !Number.isNaN(numero) && /^-?\d+([.,]\d+)?$/.test(linha.valor.trim())
    ? numero
    : linha.valor;
  return { ...base, valor };
}

function condicaoFolhaParaLinha(folha: { campo: CampoReferencia; operador: OperadorRegra; valor?: unknown }): CondicaoLinha {
  const valor = Array.isArray(folha.valor) ? folha.valor.join(", ") : folha.valor === undefined ? "" : String(folha.valor);
  return { fonte: folha.campo.fonte, campo: folha.campo.campo, operador: folha.operador, valor };
}

function grupoParaLinhas(grupo: GrupoCondicao | null): { operadorGrupo: "AND" | "OR"; linhas: CondicaoLinha[] } {
  if (!grupo) return { operadorGrupo: "AND", linhas: [{ fonte: "card", campo: CAMPOS_FIXOS_POR_FONTE.card[0], operador: "igual", valor: "" }] };
  const linhas = grupo.condicoes
    .filter((item): item is Extract<typeof item, { tipo: "condicao" }> => "tipo" in item && item.tipo === "condicao")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item) => condicaoFolhaParaLinha(item as any));
  return { operadorGrupo: grupo.operador, linhas: linhas.length > 0 ? linhas : [{ fonte: "card", campo: CAMPOS_FIXOS_POR_FONTE.card[0], operador: "igual", valor: "" }] };
}

export function RegraFormDialog({ regra, pipelines, onClose, onSaved }: Props) {
  const [nome, setNome] = useState(regra?.nome ?? "");
  const [descricao, setDescricao] = useState(regra?.descricao ?? "");
  const [ativa, setAtiva] = useState(regra?.ativa ?? true);
  const [prioridade, setPrioridade] = useState(String(regra?.prioridade ?? 0));
  const [pipelineId, setPipelineId] = useState<string>(regra?.pipelineId ?? "");
  const [etapasIds, setEtapasIds] = useState<string[]>(regra?.etapasIds ?? []);

  const grupoInicial = grupoParaLinhas(regra?.condicao ?? null);
  const [operadorGrupo, setOperadorGrupo] = useState<"AND" | "OR">(grupoInicial.operadorGrupo);
  const [linhas, setLinhas] = useState<CondicaoLinha[]>(grupoInicial.linhas);

  const [resultadoTipo, setResultadoTipo] = useState<ResultadoRegra["tipo"]>(regra?.resultado?.tipo ?? "bloqueio_movimentacao");
  const [mensagem, setMensagem] = useState(
    regra?.resultado && "mensagem" in regra.resultado ? regra.resultado.mensagem ?? "" : "",
  );
  const [jsonAvancado, setJsonAvancado] = useState(regra?.resultado?.tipo === "tabela_decisao" ? JSON.stringify(regra.resultado, null, 2) : "");
  const [campoObrigatorioFonte, setCampoObrigatorioFonte] = useState<FonteCampo>("card");
  const [campoObrigatorioCampo, setCampoObrigatorioCampo] = useState<string>(CAMPOS_FIXOS_POR_FONTE.card[0]);

  const [salvando, startTransition] = useTransition();

  const pipelineSelecionado = useMemo(() => pipelines.find((item) => item.id === pipelineId), [pipelines, pipelineId]);

  function atualizarLinha(indice: number, patch: Partial<CondicaoLinha>) {
    setLinhas((atual) => atual.map((linha, index) => (index === indice ? { ...linha, ...patch } : linha)));
  }

  function montarResultado(): ResultadoRegra | null {
    if (resultadoTipo === "tabela_decisao") {
      try {
        const parsed = JSON.parse(jsonAvancado || "{}");
        return { tipo: "tabela_decisao", ...parsed } as ResultadoRegra;
      } catch {
        return null;
      }
    }
    if (resultadoTipo === "bloqueio_movimentacao" || resultadoTipo === "mensagem_validacao") {
      return { tipo: resultadoTipo, mensagem };
    }
    if (resultadoTipo === "campo_obrigatorio") {
      return {
        tipo: "campo_obrigatorio",
        campos: [campoParaReferencia(campoObrigatorioFonte, campoObrigatorioCampo)],
        mensagem: mensagem || undefined,
      };
    }
    // calculo / formula_segura / resultado_condicional exigem estruturas específicas
    // que, nesta primeira versão da UI, ficam disponíveis via editor avançado (JSON).
    try {
      const parsed = JSON.parse(jsonAvancado || "{}");
      return { tipo: resultadoTipo, ...parsed } as ResultadoRegra;
    } catch {
      return null;
    }
  }

  function salvar() {
    const condicao: GrupoCondicao = { operador: operadorGrupo, condicoes: linhas.map(linhaParaCondicaoFolha) };
    const resultado = montarResultado();
    if (!resultado) {
      toast.error("Resultado inválido — revise o JSON avançado.");
      return;
    }
    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      ativa,
      prioridade: Number(prioridade) || 0,
      pipelineId: pipelineId || undefined,
      etapasIds: etapasIds.length > 0 ? etapasIds : undefined,
      condicao,
      resultado,
    };
    const validado = salvarRegraBpmSchema.safeParse(payload);
    if (!validado.success) {
      toast.error(validado.error.issues[0]?.message ?? "Revise os dados da regra.");
      return;
    }
    startTransition(async () => {
      const resposta = regra
        ? await AtualizarRegraBpm({ ...validado.data, id: regra.id })
        : await CriarRegraBpm(validado.data);
      if (!resposta.success) {
        toast.error(resposta.error);
        return;
      }
      toast.success(regra ? "Regra atualizada" : "Regra criada");
      onSaved();
    });
  }

  const precisaJsonAvancado = resultadoTipo === "calculo" || resultadoTipo === "formula_segura" || resultadoTipo === "resultado_condicional" || resultadoTipo === "tabela_decisao";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{regra ? "Editar regra" : "Nova regra"}</DialogTitle>
          <DialogDescription>
            Defina a condição (SE) e o resultado (ENTÃO) da regra. Alterar a condição ou o resultado cria uma nova versão automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Nome</label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Transcrição obrigatória" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Prioridade (menor = avaliada primeiro)</label>
              <Input type="number" value={prioridade} onChange={(event) => setPrioridade(event.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Descrição (opcional)</label>
            <Input value={descricao} onChange={(event) => setDescricao(event.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Pipeline (vazio = todos)</label>
              <Select value={pipelineId || "TODOS"} onValueChange={(value) => { setPipelineId(value === "TODOS" ? "" : value); setEtapasIds([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os pipelines</SelectItem>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 px-3">
              <span className="text-xs font-medium text-slate-400">Ativa</span>
              <Switch checked={ativa} onCheckedChange={setAtiva} />
            </div>
          </div>

          {pipelineSelecionado && pipelineSelecionado.etapas.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Etapas (vazio = todas as etapas do pipeline)</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 p-2">
                {pipelineSelecionado.etapas.map((etapa) => (
                  <label key={etapa.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300">
                    <Checkbox
                      checked={etapasIds.includes(etapa.id)}
                      onCheckedChange={(checked) =>
                        setEtapasIds((atual) => (checked ? [...atual, etapa.id] : atual.filter((id) => id !== etapa.id)))
                      }
                    />
                    {etapa.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">SE (condição)</span>
              <Select value={operadorGrupo} onValueChange={(value) => setOperadorGrupo(value as "AND" | "OR")}>
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">E (AND)</SelectItem>
                  <SelectItem value="OR">OU (OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linhas.map((linha, indice) => (
              <div key={indice} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-1.5">
                <Select value={linha.fonte} onValueChange={(value) => atualizarLinha(indice, { fonte: value as FonteCampo, campo: value === "campo_dinamico" ? "" : CAMPOS_FIXOS_POR_FONTE[value as keyof typeof CAMPOS_FIXOS_POR_FONTE]?.[0] ?? "" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONTES.map((fonte) => <SelectItem key={fonte} value={fonte}>{FONTE_LABEL[fonte]}</SelectItem>)}
                  </SelectContent>
                </Select>

                {linha.fonte === "campo_dinamico" ? (
                  <Input className="h-8 text-xs" placeholder="CUID do campo" value={linha.campo} onChange={(event) => atualizarLinha(indice, { campo: event.target.value })} />
                ) : (
                  <Select value={linha.campo} onValueChange={(value) => atualizarLinha(indice, { campo: value })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPOS_FIXOS_POR_FONTE[linha.fonte].map((campo) => <SelectItem key={campo} value={campo}>{campo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <Select value={linha.operador} onValueChange={(value) => atualizarLinha(indice, { operador: value as OperadorRegra })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERADORES_REGRAS.map((operador) => <SelectItem key={operador} value={operador}>{OPERADOR_LABEL[operador]}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Input
                  className="h-8 text-xs"
                  disabled={OPERADORES_SEM_VALOR.has(linha.operador)}
                  placeholder={OPERADORES_LISTA.has(linha.operador) ? "a, b, c" : "valor"}
                  value={linha.valor}
                  onChange={(event) => atualizarLinha(indice, { valor: event.target.value })}
                />

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLinhas((atual) => atual.filter((_, index) => index !== indice))} disabled={linhas.length === 1}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setLinhas((atual) => [...atual, { fonte: "card", campo: CAMPOS_FIXOS_POR_FONTE.card[0], operador: "igual", valor: "" }])}
            >
              <Plus size={14} className="mr-1" /> Adicionar condição
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <span className="text-xs font-semibold text-slate-300">ENTÃO (resultado)</span>
            <Select value={resultadoTipo} onValueChange={(value) => setResultadoTipo(value as ResultadoRegra["tipo"])}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RESULTADO_TIPO_LABEL).map(([tipo, label]) => <SelectItem key={tipo} value={tipo}>{label}</SelectItem>)}
              </SelectContent>
            </Select>

            {(resultadoTipo === "bloqueio_movimentacao" || resultadoTipo === "mensagem_validacao" || resultadoTipo === "campo_obrigatorio") && (
              <Input placeholder="Mensagem exibida ao usuário" value={mensagem} onChange={(event) => setMensagem(event.target.value)} />
            )}

            {resultadoTipo === "campo_obrigatorio" && (
              <div className="grid grid-cols-2 gap-1.5">
                <Select value={campoObrigatorioFonte} onValueChange={(value) => { setCampoObrigatorioFonte(value as FonteCampo); setCampoObrigatorioCampo(CAMPOS_FIXOS_POR_FONTE[value as keyof typeof CAMPOS_FIXOS_POR_FONTE]?.[0] ?? ""); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONTES.filter((fonte) => fonte !== "campo_dinamico").map((fonte) => <SelectItem key={fonte} value={fonte}>{FONTE_LABEL[fonte]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={campoObrigatorioCampo} onValueChange={setCampoObrigatorioCampo}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPOS_FIXOS_POR_FONTE[campoObrigatorioFonte as keyof typeof CAMPOS_FIXOS_POR_FONTE].map((campo) => <SelectItem key={campo} value={campo}>{campo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {precisaJsonAvancado && (
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500">
                  Este tipo de resultado usa o editor avançado — preencha o restante do objeto JSON (sem o campo &quot;tipo&quot;, já definido acima).
                </p>
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-slate-300 outline-none focus:border-white/20"
                  value={jsonAvancado}
                  onChange={(event) => setJsonAvancado(event.target.value)}
                  placeholder={
                    resultadoTipo === "calculo"
                      ? '{"operacao":"soma","operandos":[{"fonte":"card","campo":"..."}],"campoDestino":{"fonte":"campo_dinamico","campo":"..."}}'
                      : resultadoTipo === "formula_segura"
                        ? '{"expressao":"...","campoDestino":{"fonte":"campo_dinamico","campo":"..."}}'
                        : resultadoTipo === "tabela_decisao"
                          ? '{"tabela":{"linhas":[{"condicao":{...},"resultado":"..."}]},"campoDestino":{...}}'
                          : '{"valor":"...","campoDestino":{"fonte":"campo_dinamico","campo":"..."}}'
                  }
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
