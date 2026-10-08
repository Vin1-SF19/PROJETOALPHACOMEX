// Nunca encaminhar mensagens livres, respostas HTTP, nomes ou credenciais dos erros.
export function diagnosticoColeta(result) {
  const empresas = Array.isArray(result.empresas) ? result.empresas : [];
  const erros = Array.isArray(result.erros) ? result.erros : [];
  const conhecidos = new Map([
    ['Resposta do ranking sem result[0].data.', 'ranking_invalido'],
    ['maxPage ausente ou inválido; paginação não pode ser confirmada.', 'paginacao_invalida'],
    ['Página vazia antes do fim informado.', 'pagina_vazia'],
    ['Resposta do perfil sem os campos cnpj/address esperados.', 'perfil_invalido'],
    ['Registro sem nome de consignatário.', 'empresa_invalida'],
    ['Filtro de período ausente.', 'filtro_invalido'],
  ]);
  const falhas = [...new Set(erros.map(erro => {
    const status = erro?.statusHttp;
    if (Number.isInteger(status) && status >= 400 && status <= 599) return `http_${status}`;
    if (['timeout', 'conexao', 'resposta_invalida'].includes(erro?.tipo)) return erro.tipo;
    return conhecidos.get(erro?.erro) || 'falha_coleta';
  }))];
  const preenchidos = empresas.filter(e => typeof e.cnpj === 'string' && e.cnpj.trim()).length;
  return { status: ['concluido', 'concluido_com_erros', 'interrompido'].includes(result.status) ? result.status : 'desconhecido',
    recebidas: empresas.length, semCnpj: empresas.length - preenchidos,
    paginas: Number.isSafeInteger(result.paginasConsultadas) && result.paginasConsultadas >= 0 ? result.paginasConsultadas : 0,
    falhas };
}
