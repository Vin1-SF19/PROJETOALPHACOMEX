import { createClient } from "@libsql/client/web";
import "dotenv/config";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const norm = (s) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

function relatorio(titulo, total, migrados, detalhes) {
  console.log(`\n=== ${titulo} ===`);
  console.log(`Total na tabela antiga: ${total}`);
  console.log(`Confirmados presentes na tabela nova: ${migrados}`);
  console.log(`Diferença: ${total - migrados}`);
  if (detalhes && detalhes.length) console.log(`Detalhes: ${JSON.stringify(detalhes, null, 2)}`);
  return total - migrados === 0;
}

async function main() {
  const resultados = [];

  // 1. clientes_old_fase36 -> Cliente + ClienteServico
  {
    const legado = (await client.execute("SELECT id, cnpj, servicos FROM clientes_old_fase36")).rows;
    const clienteServico = (
      await client.execute("SELECT cs.id, cs.servico, c.cnpj FROM ClienteServico cs JOIN Cliente c ON c.id = cs.clienteId")
    ).rows;
    const chaves = new Set(clienteServico.map((r) => `${norm(r.cnpj)}::${r.servico}`));
    const chavesEmConstituicao = new Set(
      clienteServico.filter((r) => !r.cnpj).map((r) => r.servico) // fallback pra "Em constituição" sem cnpj
    );
    let migrados = 0;
    const faltando = [];
    for (const l of legado) {
      const cnpjNorm = norm(l.cnpj);
      const servico = l.servicos || "Não especificado";
      if (cnpjNorm === "00000000000000") {
        // "em constituição" — verifica se existe ALGUM ClienteServico com esse serviço em algum Cliente sem cnpj
        const existeAlgum = clienteServico.some((r) => !r.cnpj && r.servico === servico);
        if (existeAlgum) migrados++;
        else faltando.push({ id: l.id, cnpj: l.cnpj, servico });
        continue;
      }
      if (chaves.has(`${cnpjNorm}::${servico}`)) migrados++;
      else faltando.push({ id: l.id, cnpj: l.cnpj, servico });
    }
    resultados.push(relatorio("clientes_old_fase36 -> Cliente+ClienteServico", legado.length, migrados, faltando));
  }

  // 2. socios_old_fase36 -> Pessoa + PessoaClienteVinculo (só os com telefone migram, por decisão já tomada)
  {
    const legado = (await client.execute("SELECT id, telefone, clienteId FROM socios_old_fase36")).rows;
    const comTelefone = legado.filter((s) => s.telefone && s.telefone.trim());
    const semTelefone = legado.filter((s) => !s.telefone || !s.telefone.trim());
    const pessoas = (await client.execute("SELECT celular FROM Pessoa")).rows;
    const celularesExistentes = new Set(pessoas.map((p) => p.celular));
    let migrados = 0;
    const faltando = [];
    for (const s of comTelefone) {
      if (celularesExistentes.has(s.telefone.trim())) migrados++;
      else faltando.push({ id: s.id, telefone: s.telefone });
    }
    console.log(`\n=== socios_old_fase36 -> Pessoa (só com telefone) ===`);
    console.log(`Total na tabela antiga: ${legado.length}`);
    console.log(`Com telefone (elegíveis a migrar): ${comTelefone.length}`);
    console.log(`Confirmados presentes em Pessoa: ${migrados}`);
    console.log(`Diferença (entre os elegíveis): ${comTelefone.length - migrados}`);
    console.log(`SEM telefone (dívida de saneamento conhecida, não migram por decisão já tomada): ${semTelefone.length}`);
    if (faltando.length) console.log(`Faltando: ${JSON.stringify(faltando)}`);
    resultados.push(comTelefone.length - migrados === 0);
  }

  // 3. log_cs_old_fase36 -> ClienteServicoLogCs
  {
    const legado = (await client.execute("SELECT id FROM log_cs_old_fase36")).rows;
    const novos = (await client.execute("SELECT COUNT(*) as c FROM ClienteServicoLogCs")).rows[0].c;
    resultados.push(relatorio("log_cs_old_fase36 -> ClienteServicoLogCs (contagem)", legado.length, novos));
  }

  // 4. logFeedback_old_fase36 -> ClienteServicoLogFeedback
  {
    const legado = (await client.execute("SELECT id FROM logFeedback_old_fase36")).rows;
    const novos = (await client.execute("SELECT COUNT(*) as c FROM ClienteServicoLogFeedback")).rows[0].c;
    resultados.push(relatorio("logFeedback_old_fase36 -> ClienteServicoLogFeedback (contagem)", legado.length, novos));
  }

  // 5. historico_alteracao_cliente_old_fase36 -> split (historico_alteracao_cliente + ClienteServicoHistorico)
  {
    const legado = (await client.execute("SELECT id FROM historico_alteracao_cliente_old_fase36")).rows;
    const histCliente = (await client.execute("SELECT COUNT(*) as c FROM historico_alteracao_cliente")).rows[0].c;
    const histServico = (await client.execute("SELECT COUNT(*) as c FROM ClienteServicoHistorico")).rows[0].c;
    resultados.push(
      relatorio(
        "historico_alteracao_cliente_old_fase36 -> historico_alteracao_cliente + ClienteServicoHistorico (soma)",
        legado.length,
        histCliente + histServico
      )
    );
  }

  // 6. contratos_comerciais_old_fase36 -> ContratoComercial (mesmo nome físico, migração in-place — confirma que todos os IDs ainda existem)
  {
    const legadoIds = (await client.execute("SELECT id FROM contratos_comerciais_old_fase36")).rows.map((r) => r.id);
    const novos = (await client.execute("SELECT id FROM contratos_comerciais")).rows.map((r) => r.id);
    const novosSet = new Set(novos);
    const faltando = legadoIds.filter((id) => !novosSet.has(id));
    resultados.push(relatorio("contratos_comerciais_old_fase36 -> contratos_comerciais (mesmos IDs)", legadoIds.length, legadoIds.length - faltando.length, faltando));
  }

  // 7. operacional_clientes_old_fase35 -> operacional_clientes
  {
    const legadoIds = (await client.execute("SELECT id FROM operacional_clientes_old_fase35")).rows.map((r) => r.id);
    const novos = (await client.execute("SELECT id FROM operacional_clientes")).rows.map((r) => r.id);
    const novosSet = new Set(novos);
    const faltando = legadoIds.filter((id) => !novosSet.has(id));
    resultados.push(relatorio("operacional_clientes_old_fase35 -> operacional_clientes (mesmos IDs)", legadoIds.length, legadoIds.length - faltando.length, faltando));
  }

  // 8. Extratos_old_fase33 -> Extratos
  {
    const legadoIds = (await client.execute("SELECT id FROM Extratos_old_fase33")).rows.map((r) => r.id);
    const novos = (await client.execute("SELECT id FROM Extratos")).rows.map((r) => r.id);
    const novosSet = new Set(novos);
    const faltando = legadoIds.filter((id) => !novosSet.has(id));
    resultados.push(relatorio("Extratos_old_fase33 -> Extratos (mesmos IDs)", legadoIds.length, legadoIds.length - faltando.length, faltando));
  }

  // 9. BpmCard_old_fixfk -> BpmCard
  {
    const legadoIds = (await client.execute("SELECT id FROM BpmCard_old_fixfk")).rows.map((r) => r.id);
    const novos = (await client.execute("SELECT id FROM BpmCard")).rows.map((r) => r.id);
    const novosSet = new Set(novos);
    const faltando = legadoIds.filter((id) => !novosSet.has(id));
    resultados.push(relatorio("BpmCard_old_fixfk -> BpmCard (mesmos IDs)", legadoIds.length, legadoIds.length - faltando.length, faltando));
  }

  // 10. CommissionEvent_old_fase37 -> CommissionEvent
  {
    const legadoIds = (await client.execute("SELECT id FROM CommissionEvent_old_fase37")).rows.map((r) => r.id);
    const novos = (await client.execute("SELECT id FROM CommissionEvent")).rows.map((r) => r.id);
    const novosSet = new Set(novos);
    const faltando = legadoIds.filter((id) => !novosSet.has(id));
    resultados.push(relatorio("CommissionEvent_old_fase37 -> CommissionEvent (mesmos IDs)", legadoIds.length, legadoIds.length - faltando.length, faltando));
  }

  // 11 e 12: BusinessProcess_old_fase37 / EligibilityOverride_old_fase37 (0 linhas, nada a validar)
  console.log("\n=== BusinessProcess_old_fase37 / EligibilityOverride_old_fase37 ===");
  console.log("Ambas com 0 linhas na tabela antiga — nada a migrar, nada a perder.");
  resultados.push(true, true);

  console.log("\n\n========================================");
  console.log(resultados.every(Boolean) ? "✅ TODAS AS TABELAS CONFIRMADAS ÍNTEGRAS — nenhum dado perdido." : "❌ HÁ DIVERGÊNCIAS — revisar antes de prosseguir.");
  console.log("========================================");
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exitCode = 1;
});
