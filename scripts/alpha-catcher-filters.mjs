// Mantém autenticação, paginação e retries do coletor original; substitui somente o período.
export function fetchComPeriodo(periodo, fetcher = fetch) {
  return (url, options) => {
    const body = JSON.parse(options.body);
    const filtro = body.filters?.find(item => item.field === 'data_operacao');
    if (!filtro) throw new Error('Filtro de período ausente.');
    filtro.value = [periodo.dataInicio, periodo.dataFinal];
    return fetcher(url, { ...options, body: JSON.stringify(body) });
  };
}
