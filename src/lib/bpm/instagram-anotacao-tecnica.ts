/** Identifica somente o bloco gerado pela integração, inclusive o template legado. */
export function ehAnotacaoTecnicaInstagram(item: { tipo?: string | null; resumo?: string | null; observacoes?: string | null }): boolean {
  if (item.tipo !== "ANOTACAO" || item.resumo !== "Dados recebidos do Instagram") return false;
  const linhas = item.observacoes?.replace(/\r\n/g, "\n").split("\n") ?? [];
  if (linhas[0] !== "Lead recebido do Instagram — Google Sheets") return false;
  return ["ID do lead:", "Captado em:", "Nome do contato:", "E-mail informado:", "WhatsApp informado:",
    "CNPJ informado:", "Radar pretendido (coluna M):", "Volume pretendido em 12 meses:", "Prazo desejado:",
    "Orgânico:", "Status na origem:"].every((rotulo) => linhas.some((linha) => linha.startsWith(rotulo)));
}
