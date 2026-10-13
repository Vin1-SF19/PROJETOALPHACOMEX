// Cada perfil é publicado imediatamente; obter o total não bloqueia a coleta.
export async function coletarProgressivo({ api, coletar, data, limite, faixa, emitir, salvar = async () => {}, conhecidos = new Map() }) {
  const paginas = new Map(), pedidos = new Map();
  let paginaTotal = null, totalLista = null, alvo = Number.isFinite(limite) ? limite : null;
  let processadas = 0, cnpjs = 0, tamanhoPagina = null, fase = 'ranking', encerrado = false;
  const progresso = () => encerrado ? Promise.resolve() : emitir({ type: 'progresso', progresso: { fase, totalLista, total: alvo, coletadas: processadas, cnpjs, paginas: paginas.size, paginasTotal: paginaTotal } });
  function atualizarTotal() {
    const ultima = paginas.get(paginaTotal)?.result?.[0]?.data;
    if (paginaTotal === 1 && Array.isArray(ultima)) totalLista = ultima.length;
    else if (tamanhoPagina && Array.isArray(ultima) && ultima.length > 0 && ultima.length <= tamanhoPagina) totalLista = (paginaTotal - 1) * tamanhoPagina + ultima.length;
    if (paginaTotal && paginas.size === paginaTotal) {
      const nomes = new Set();
      for (const raw of paginas.values()) for (const row of raw.result?.[0]?.data || []) if (typeof row.consignatario === 'string') nomes.add(row.consignatario);
      totalLista = nomes.size;
    }
    if (totalLista !== null) alvo = Math.min(totalLista, limite);
  }
  const carregarPagina = page => {
    if (!pedidos.has(page)) pedidos.set(page, (async () => {
      const raw = await api.ranking(data, page, faixa);
      if (Array.isArray(raw?.result?.[0]?.data)) paginas.set(page, raw);
      atualizarTotal();
      return raw;
    })().catch(error => { pedidos.delete(page); throw error; }));
    return pedidos.get(page);
  };
  await progresso();
  const publicados = new Set();
  const streamingApi = {
    ranking: async (_data, page) => {
      const raw = await carregarPagina(page);
      const rows = raw?.result?.[0]?.data;
      if (page === 1 && Array.isArray(rows)) {
        tamanhoPagina = rows.length;
        const max = Number(raw?.result?.[0]?.summary?.remaining?.maxPage);
        paginaTotal = Number.isSafeInteger(max) && max > 0 ? max : rows.length === 0 ? 1 : null;
        atualizarTotal();
        // Apenas a última página em paralelo: não baixar o ranking inteiro antes dos perfis.
        if (!Number.isFinite(limite) && paginaTotal > 1) {
          carregarPagina(paginaTotal).then(() => progresso()).catch(() => {});
        }
      }
      fase = 'perfis'; await progresso();
      return raw;
    },
    perfil: async (dataPerfil, nome) => {
      try {
        if (conhecidos.has(nome)) return { cnpj: conhecidos.get(nome), address: {} };
        const perfil = await api.perfil(dataPerfil, nome);
        if (perfil && typeof perfil === 'object' && !Array.isArray(perfil) && 'cnpj' in perfil && 'address' in perfil && !publicados.has(nome)) {
          publicados.add(nome);
          if (typeof perfil.cnpj === 'string' && perfil.cnpj.trim()) {
            cnpjs++;
            await emitir({ type: 'empresa', empresa: { cnpj: perfil.cnpj, consignatario: nome } });
          }
        }
        return perfil;
      } finally { processadas++; await progresso(); }
    },
  };
  try { return await coletar({ api: streamingApi, dataFinal: data, limite, faixa, salvar, progresso: () => {} }); }
  finally { encerrado = true; }
}
