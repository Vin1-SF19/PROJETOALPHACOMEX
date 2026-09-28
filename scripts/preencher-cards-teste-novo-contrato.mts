/** Backfill restrito aos dois cards de teste autorizados pelo usuário; prévia por padrão. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { FINANCIAL_FIELD_KEYS: K } = await import("../src/lib/bpm/pipeline-financeiro");
const { calcularNovoContrato } = await import("../src/lib/bpm/novo-contrato-financeiro");
const ids = ["cmuini24h000a09gmadd2zmu0", "cmulnujrr00060agmrmuf4t8i"];
const FIN = "cmuih4i54000209gmmyqrg557";
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");

try {
  const [campos, cards] = await Promise.all([
    db.bpmCampo.findMany({ where: { pipelineId: FIN, ativo: true }, select: { id: true, chave: true, nome: true } }),
    db.bpmCard.findMany({ where: { id: { in: ids }, pipelineId: FIN }, select: { id: true, pipelineId: true, etapaId: true, etapa: { select: { chave: true } }, responsavelId: true, campoValores: { select: { campoId: true, valor: true } } } }),
  ]);
  if (cards.length !== 2 || cards.some((card) => !ids.includes(card.id))) throw new Error("Os dois cards de teste não foram encontrados exatamente no Financeiro.");
  const porChave = new Map(campos.filter((campo) => campo.chave).map((campo) => [campo.chave, campo]));
  for (const chave of Object.values(K)) if (!porChave.has(chave)) throw new Error(`Campo não publicado: ${chave}`);
  const propostas = cards.map((card) => {
    const indice = ids.indexOf(card.id) + 1;
    const atual = new Map(card.campoValores.map((item) => [item.campoId, item.valor]));
    const base: Record<string, string> = {
      [K.CNPJ]: indice === 1 ? "90000001000129" : "90000002000173",
      [K.RAZAO_SOCIAL]: `Empresa Fictícia Financeiro ${indice} Ltda — TESTE`,
      [K.RUA]: "Rua dos Testes", [K.NUMERO]: String(100 + indice),
      [K.COMPLEMENTO]: "Sala de homologação", [K.BAIRRO]: "Centro de Testes",
      [K.CEP]: "01001-000", [K.MUNICIPIO]: "São Paulo", [K.ESTADO]: "SP",
      [K.EMAIL]: `financeiro-teste-${indice}@example.test`, [K.REGIME_CLIENTE]: "Simples Nacional",
      [K.SERVICO]: "Revisão de Radar — TESTE", [K.VALOR_BRUTO]: indice === 1 ? "1000.00" : "2000.00",
      [K.FORMA_PAGAMENTO]: "Integral na contratação - 10% OFF (Pix)",
      [K.CONDICAO]: "Condição negociada fictícia, somente para teste",
      [K.VENDEDOR]: String(card.responsavelId), [K.ORIGEM]: "Direto",
      [K.REGIME_PRESTADOR]: "Regime Normal",
      [K.IRRF_APLICAVEL]: "Não", [K.CSRF_APLICAVEL]: "Não",
      [K.VENCIMENTO]: "2026-12-31", [K.DADOS_PAGAMENTO]: "DADOS FICTÍCIOS — NÃO COBRAR; nenhum meio de pagamento real",
    };
    const efetivos = Object.fromEntries(Object.entries(base).map(([chave, valor]) => [chave, atual.get(porChave.get(chave)!.id)?.trim() || valor]));
    const calculo = calcularNovoContrato(efetivos);
    if (calculo.pendencias.length) throw new Error(`Cálculo inválido no card ${card.id}: ${calculo.pendencias.join(", ")}`);
    const desejados = { ...base, ...calculo.resultados };
    desejados[K.MEMORIA_CALCULO] = JSON.stringify({ ...JSON.parse(calculo.resultados[K.MEMORIA_CALCULO]!),
      calculadoEm: new Date().toISOString(), confirmadoPorId: null, origem: "backfill de teste" });
    if (card.etapa.chave !== "solicitacao_contrato") delete desejados[K.STATUS_FINANCEIRO];
    const faltantes = Object.entries(desejados).filter(([chave, valor]) => valor && !atual.get(porChave.get(chave)!.id)?.trim());
    return { card, faltantes };
  });
  const preview = propostas.map(({ card, faltantes }) => ({ cardId: card.id, etapaId: card.etapaId,
    preservarExistentes: card.campoValores.length, preencher: Object.fromEntries(faltantes),
  }));
  if (!aplicar) console.log(JSON.stringify({ modo: "preview", cards: preview }, null, 2));
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://") || arg("approval") !== "AUTORIZO_CARDS_TESTE_FINANCEIRO") throw new Error("Autorização específica de backfill no Turso ausente.");
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || !String(m.reason).includes("novo-contrato-financeiro") || !Number.isFinite(criado) || Date.now() - criado > 48 * 3600_000 || criado > Date.now() || b.size < 1_000_000 || b.size !== m.sizeBytes || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) throw new Error("Backup ausente, inválido ou vencido.");
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    await db.$transaction(async (tx) => {
      for (const proposta of propostas) {
        const vigente = await tx.bpmCard.findUnique({ where: { id: proposta.card.id }, select: { pipelineId: true, etapaId: true } });
        if (vigente?.pipelineId !== FIN || vigente.etapaId !== proposta.card.etapaId) throw new Error("Card alterado desde a prévia.");
        for (const [chave, valor] of proposta.faltantes) {
          const campoId = porChave.get(chave)!.id;
          const atual = await tx.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: proposta.card.id, campoId } }, select: { valor: true } });
          if (atual?.valor?.trim()) throw new Error(`Campo ${chave} foi preenchido após a prévia; operação cancelada.`);
          await tx.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId: proposta.card.id, campoId } }, create: { cardId: proposta.card.id, campoId, valor }, update: { valor } });
        }
        if (proposta.faltantes.length) await tx.bpmCardHistorico.create({ data: { cardId: proposta.card.id, acao: "CARD_TESTE_PREENCHIDO",
          valorNovoJson: JSON.stringify({ camposAlterados: proposta.faltantes.map(([chave]) => porChave.get(chave)!.id), origem: "dados fictícios de teste" }),
        } });
      }
    }, { maxWait: 20_000, timeout: 60_000 });
    console.log(JSON.stringify({ modo: "apply", cards: preview.map((card) => ({ cardId: card.cardId, camposPreenchidos: Object.keys(card.preencher).length })) }));
  }
} finally { await db.$disconnect(); }
