function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

async function consultarCnpjWs(cnpj: string) {
  const resposta = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resposta.ok) throw new Error(`publica.cnpj.ws HTTP ${resposta.status}`);
  const dados = await resposta.json();
  if (dados.message) throw new Error(dados.message);

  const estabelecimento = dados.estabelecimento || {};
  const simples = dados.simples || {};
  const mapearCnae = (item: any) => ({ code: item.subclasse || item.id || "", text: item.descricao || "" });

  return {
    cnpj: estabelecimento.cnpj || cnpj,
    razaoSocial: (dados.razao_social || "").toUpperCase(),
    nomeFantasia: (estabelecimento.nome_fantasia || "Sem nome fantasia").toUpperCase(),
    municipio: (estabelecimento.cidade?.nome || "").toUpperCase(),
    uf: (estabelecimento.estado?.sigla || "").toUpperCase(),
    dataConstituicao: formatarData(estabelecimento.data_inicio_atividade),
    regimeTributario: simples.simples === "Sim" ? "Simples Nacional" : "Regime Normal",
    capitalSocial: dados.capital_social || 0,
    data_opcao: simples.data_opcao_simples || null,
    optante_simples: simples.simples === "Sim",
    data_exclusaoSimples: simples.data_exclusao_simples || null,
    optante_simei: simples.mei === "Sim",
    data_opcaoSimei: simples.data_opcao_mei || null,
    data_exclusaoSimei: simples.data_exclusao_mei || null,
    atividade_principal: estabelecimento.atividade_principal ? [mapearCnae(estabelecimento.atividade_principal)] : [],
    atividades_secundarias: (estabelecimento.atividades_secundarias || []).map(mapearCnae),
    abertura_bruta: estabelecimento.data_inicio_atividade || "",
    simples: {
      optante: simples.simples === "Sim",
      data_opcao: simples.data_opcao_simples || null,
      data_exclusao: simples.data_exclusao_simples || null,
    },
    bairro: (estabelecimento.bairro || "").toUpperCase(),
    cep: estabelecimento.cep,
    email: (estabelecimento.email || "").toLowerCase(),
    telefone: estabelecimento.ddd1 && estabelecimento.telefone1 ? `(${estabelecimento.ddd1}) ${estabelecimento.telefone1}` : "",
    logradouro: (estabelecimento.logradouro || "").toUpperCase(),
    numero: estabelecimento.numero,
    situacao: (estabelecimento.situacao_cadastral || "ATIVA").toUpperCase(),
    natureza_juridica: dados.natureza_juridica?.descricao || "",
    porte: dados.porte?.descricao || "",
    qsa: (dados.socios || []).map((socio: any) => ({ nome: socio.nome, qual: socio.qualificacao_socio?.descricao || "" })),
  };
}

export async function getReceitaData(cnpj: string) {
  try {
    const resposta = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (resposta.ok) {
      const dados = await resposta.json();
      if (!dados.status || dados.status === "OK") {
        return {
          cnpj: dados.cnpj,
          razaoSocial: (dados.nome || "").toUpperCase(),
          nomeFantasia: (dados.fantasia || "Sem nome fantasia").toUpperCase(),
          municipio: (dados.municipio || "").toUpperCase(),
          uf: (dados.uf || "").toUpperCase(),
          dataConstituicao: dados.abertura || "",
          regimeTributario: dados.simples?.optante ? "Simples Nacional" : "Regime Normal",
          capitalSocial: dados.capital_social || 0,
          data_opcao: dados.simples?.data_opcao || dados.opcao_pelo_simples_data || null,
          optante_simples: !!dados.simples?.optante,
          data_exclusaoSimples: dados.simples?.data_exclusao,
          optante_simei: !!dados.simei?.optante,
          data_opcaoSimei: dados.simei?.data_opcao,
          data_exclusaoSimei: dados.simei?.data_exclusao,
          atividade_principal: dados.atividade_principal || [],
          atividades_secundarias: dados.atividades_secundarias || [],
          abertura_bruta: dados.abertura,
          simples: dados.simples,
          bairro: (dados.bairro || "").toUpperCase(),
          cep: dados.cep,
          email: (dados.email || "").toLowerCase(),
          telefone: dados.telefone,
          logradouro: (dados.logradouro || "").toUpperCase(),
          numero: dados.numero,
          situacao: (dados.situacao || "ATIVA").toUpperCase(),
          natureza_juridica: dados.natureza_juridica,
          porte: dados.porte,
          qsa: dados.qsa || [],
        };
      }
    }
  } catch {
    // A segunda fonte mantém a consulta disponível em falhas transitórias.
  }

  console.log(`ReceitaWS falhou para ${cnpj}, tentando publica.cnpj.ws`);
  return consultarCnpjWs(cnpj);
}
