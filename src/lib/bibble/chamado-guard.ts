function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta se a MENSAGEM DO USUÁRIO pede para abrir/registrar um chamado — usado
 * para decidir se o turno precisa de proteção (streaming buferizado) contra uma
 * alegação falsa de sucesso. Não dispara em perguntas de consulta ("quantos
 * chamados eu tenho?", "meus chamados estão abertos?").
 */
export function mensagemSolicitaAbrirChamado(mensagem: string): boolean {
  const texto = normalizarTexto(mensagem);
  const pedeAbertura = /\b(?:abr[ei]|abre|cri[ae]|cria|registr[ae]|registra|faz|abrir|criar|registrar)\w*\b.{0,40}\bcham[ao]d[oa]s?\b/.test(texto)
    || /\bcham[ao]d[oa]s?\b.{0,40}\b(?:abr[ei]|abre|cri[ae]|cria|registr[ae]|registra|abrir|criar|registrar)\w*/.test(texto);
  return pedeAbertura;
}

/**
 * Detecta se a resposta final alega que um chamado foi aberto/criado/registrado
 * agora (não uma consulta a chamados já existentes), incluindo quando o modelo
 * inventa um número de chamado. Só é chamado quando o turno já foi identificado
 * como pedido de abertura via mensagemSolicitaAbrirChamado.
 */
export function respostaAlegaChamadoAberto(resposta: string): boolean {
  const texto = normalizarTexto(resposta);
  return /\bcham[ao]d[oa]s?\b.{0,60}\b(?:foi |esta |ja )?(?:abert[oa]|criad[oa]|registrad[oa])\b/.test(texto)
    || /\b(?:abri|criei|registrei)\b.{0,60}\bcham[ao]d[oa]\b/.test(texto);
}

export function protegerRespostaDeFalsoChamado(
  resposta: string,
  chamadoAbertoComSucesso: boolean,
): string {
  if (!chamadoAbertoComSucesso && respostaAlegaChamadoAberto(resposta)) {
    return "Não consegui confirmar a abertura do chamado no sistema. Pode me passar novamente o título, a descrição e a prioridade para eu tentar registrar de novo?";
  }
  return resposta;
}

export function resultadoAbrirChamadoConcluido(toolName: string, resultado: string): boolean {
  if (toolName !== "abrir_chamado") return false;
  return resultado.startsWith("SUCESSO_ABRIR_CHAMADO");
}
