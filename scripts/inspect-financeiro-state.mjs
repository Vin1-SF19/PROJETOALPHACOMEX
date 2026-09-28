import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma.ts");
const pipelineId = "cmuih4i54000209gmmyqrg557";
const [pipeline, etapas, formularios, secoes, componentes, campos] = await Promise.all([
  db.$queryRawUnsafe(`SELECT id, nome, chave, ativo, configVersion FROM BpmPipeline WHERE id = ?`, pipelineId),
  db.$queryRawUnsafe(`SELECT id, nome, chave, ordem, ativo FROM BpmEtapa WHERE pipelineId = ? ORDER BY ordem`, pipelineId),
  db.$queryRawUnsafe(`SELECT f.id, f.etapaId, f.versao, f.ativo, e.nome as etapa, e.chave as etapaChave FROM BpmEtapaFormulario f JOIN BpmEtapa e ON e.id=f.etapaId WHERE e.pipelineId = ? ORDER BY e.ordem, f.versao DESC`, pipelineId),
  db.$queryRawUnsafe(`SELECT s.id, s.formularioId, s.chave, s.titulo, s.ordem FROM BpmFormularioSecao s WHERE s.formularioId IN (SELECT id FROM BpmEtapaFormulario WHERE etapaId IN (SELECT id FROM BpmEtapa WHERE pipelineId = ?)) ORDER BY s.ordem`, pipelineId),
  db.$queryRawUnsafe(`SELECT c.id, c.secaoId, c.chave, c.tipo, c.campoId, c.capability, c.ordem FROM BpmFormularioComponente c WHERE c.secaoId IN (SELECT id FROM BpmFormularioSecao WHERE formularioId IN (SELECT id FROM BpmEtapaFormulario WHERE etapaId IN (SELECT id FROM BpmEtapa WHERE pipelineId = ?))) ORDER BY c.ordem`, pipelineId),
  db.$queryRawUnsafe(`SELECT c.id, c.nome, c.chave, c.tipo, c.ativo, c.etapaId, c.pipelineId FROM BpmCampo c WHERE c.pipelineId = ? OR c.etapaId IN (SELECT id FROM BpmEtapa WHERE pipelineId = ?) ORDER BY c.etapaId, c.pipelineId, c.ordem`, pipelineId, pipelineId),
]);
console.log(JSON.stringify({
  pipeline,
  etapas,
  formularios,
  totalSecoes: secoes.length,
  secoes,
  totalComponentes: componentes.length,
  componentes,
  totalCampos: campos.length,
  campos,
}, null, 2));
await db.$disconnect();
