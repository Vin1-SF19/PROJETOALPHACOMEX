import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";
import {
  atualizarCardSchema,
  criarTarefaSchema,
  dataHoraObrigatoriaBpmSchema,
} from "@/lib/validations/bpm";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

describe("Alpha CRM - seleção assistida de data e hora", () => {
  it("preserva o valor civil de São Paulo no round-trip", () => {
    const valor = "2026-09-04T09:35";
    const instante = parseDataHoraLocalBpm(valor);
    expect(instante?.toISOString()).toBe("2026-09-04T12:35:00.000Z");
    expect(formatarDataHoraLocalBpm(instante)).toBe(valor);
  });

  it.each([
    ["início do dia", "2030-01-15T00:00", "2030-01-15T03:00:00.000Z"],
    ["fim do dia", "2030-01-15T23:59", "2030-01-16T02:59:00.000Z"],
    ["virada de mês", "2030-04-30T23:59", "2030-05-01T02:59:00.000Z"],
    ["virada de ano", "2030-12-31T23:59", "2031-01-01T02:59:00.000Z"],
    ["fevereiro em ano bissexto", "2028-02-29T12:30", "2028-02-29T15:30:00.000Z"],
  ])("preserva data futura em %s", (_cenario, valorCivil, isoEsperada) => {
    const instante = parseDataHoraLocalBpm(valorCivil);

    expect(instante?.toISOString()).toBe(isoEsperada);
    expect(formatarDataHoraLocalBpm(instante)).toBe(valorCivil);
  });

  it.each([
    "2027-02-29T12:30",
    "2028-02-30T12:30",
    "2030-04-31T12:30",
    "2030-12-31T24:00",
    "2030-01-01T23:60",
  ])("rejeita limite civil impossível: %s", (valorCivil) => {
    expect(parseDataHoraLocalBpm(valorCivil)).toBeNull();
  });

  it("rejeita valor parcial e data impossível antes do envio", () => {
    expect(parseDataHoraLocalBpm("")).toBeNull();
    expect(parseDataHoraLocalBpm("2026-02-30T10:00")).toBeNull();
    expect(parseDataHoraLocalBpm("2026-09-04T25:00")).toBeNull();
  });

  it("aceita no backend somente Date válida, ISO estrita e timestamp finito", () => {
    const schema = dataHoraObrigatoriaBpmSchema("Data e hora são obrigatórias");
    const instante = "2026-09-04T12:35:00.000Z";

    expect(schema.parse(new Date(instante)).toISOString()).toBe(instante);
    expect(schema.parse(instante).toISOString()).toBe(instante);
    expect(schema.parse("2026-09-04T09:35:00-03:00").toISOString()).toBe(instante);
    expect(schema.parse(Date.parse(instante)).toISOString()).toBe(instante);
  });

  it.each([
    "09/04/2026 10:30",
    "September 4, 2026 10:30",
    "0",
    "2026-09-04",
    "2026-02-30T10:30:00Z",
    "",
    null,
    false,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    new Date("data-invalida"),
  ])("rejeita entrada obrigatória fora do contrato: %s", (valor) => {
    expect(dataHoraObrigatoriaBpmSchema("Data e hora são obrigatórias").safeParse(valor).success).toBe(false);
  });

  it("preserva limpeza opcional, rejeita parser local e aceita limites do dia", () => {
    const base = { cardId: "clw0000000000000card" };

    expect(atualizarCardSchema.parse({ ...base, proximoContatoEm: "" }).proximoContatoEm).toBeNull();
    expect(atualizarCardSchema.parse({ ...base, proximoContatoEm: null }).proximoContatoEm).toBeNull();
    expect(atualizarCardSchema.safeParse({ ...base, proximoContatoEm: "09/04/2026 10:30" }).success).toBe(false);
    expect(atualizarCardSchema.parse({ ...base, proximoContatoEm: "2026-09-04T00:00:00-03:00" }).proximoContatoEm?.toISOString())
      .toBe("2026-09-04T03:00:00.000Z");
    expect(atualizarCardSchema.parse({ ...base, proximoContatoEm: "2026-09-04T23:59:59-03:00" }).proximoContatoEm?.toISOString())
      .toBe("2026-09-05T02:59:59.000Z");
  });

  it("mantém prazo e alerta obrigatórios e compara os instantes normalizados", () => {
    const resultado = criarTarefaSchema.safeParse({
      cardId: "clw0000000000000card",
      tipo: "TAREFA",
      titulo: "Retornar",
      prazo: "2026-09-04T23:59:00-03:00",
      alertaEm: "2026-09-04T00:00:00-03:00",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.prazo.toISOString()).toBe("2026-09-05T02:59:00.000Z");
      expect(resultado.data.alertaEm.toISOString()).toBe("2026-09-04T03:00:00.000Z");
    }
  });

  it("expõe calendário, hora, edição controlada, limpeza opcional e acessibilidade", () => {
    const campo = ler("src/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField.tsx");
    expect(campo).toContain("<DayPicker");
    expect(campo).toContain('type="time"');
    expect(campo).toContain("selected={selected}");
    expect(campo).toContain("onSelect={selecionarData}");
    expect(campo).toContain("onChange(proximoValor)");
    expect(campo).not.toContain("onCommit?.(proximoValor)");
    expect(campo).toContain("allowClear && value");
    expect(campo).toContain('aria-invalid={Boolean(error)}');
    expect(campo).toContain("collisionPadding={12}");
    expect(campo).toContain("setCalendarOpen(false)");
  });

  it("preserva rascunhos de reunião em atualizações do card sem remount por updatedAt", () => {
    const slot = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx");
    const reuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");

    expect(slot).not.toContain("key={`reuniao-${card.updatedAt.toString()}`}");
    expect(reuniao).toContain("dataHoraSujaRef.current");
    expect(reuniao).toContain("resumoSujoRef.current");
    expect(reuniao).toContain("Seu rascunho foi preservado");
  });

  it("mantém autosave no próximo contato e envio único nos formulários explícitos", () => {
    const contato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
    const reuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");
    const tarefas = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx");
    expect(contato).toContain("onCommit={(novoValor) => void persistir");
    expect(contato).toContain("registerSave");
    expect(contato).toContain("allowClear");
    expect(contato).toContain("dataPersistida?.toISOString() ?? null");
    expect(reuniao).toContain("if (salvando || !podeEditar) return");
    expect(tarefas).toContain("if (salvando || !podeTrabalharTarefas) return");
    expect(tarefas).toContain('aria-busy={salvando}');
  });

  it("propaga a permissão da etapa aos controles de edição do formulário", () => {
    const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
    const contato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
    const reuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");

    expect(modal).toContain("const podeAgirNaEtapa = card?.permissaoEtapa?.podeAgir ?? true");
    expect(modal).toContain("(Boolean(meuVinculo) && podeAgirNaEtapa)");
    expect(modal).toContain("podeEditar={podeEditar}");
    expect(contato).toContain("disabled={!podeEditar}");
    expect(reuniao).toContain("disabled={!podeEditar || salvando");
  });
});
