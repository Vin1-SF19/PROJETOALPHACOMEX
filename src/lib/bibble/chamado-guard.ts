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
  const textoClassificavel = texto.replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’/g, " ");
  const chamado = "cham[ao]d[oa]s?";
  const acao = "(?:abra|crie|registre|faca|abrir|criar|registrar|fazer)";
  const infinitivo = "(?:abrir|criar|registrar|fazer)";
  if (new RegExp(`\\bnao\\b.{0,20}\\b${acao}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\b(?:como|onde|quando)\\b.{0,30}\\b(?:abrir|criar|registrar|fazer)\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\b(?:explique|interprete|analise|traduza)\\b.{0,40}\\b(?:frase|texto|mensagem|email|citacao)\\b.{0,80}\\b${acao}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\b(?:email|mensagem|texto)\\b.{0,30}\\b(?:diz|disse|fala|contem)\\b.{0,80}\\b${acao}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\bse\\b.{0,40}\\b(?:alguem|pessoa|usuario|ele|ela)\\b.{0,50}\\b(?:disser|pedir|mandar)?\\b.{0,20}\\b${acao}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\b(?:ele|ela|alguem|usuario)\\b.{0,30}\\b(?:disse|falou|mandou)\\b.{0,30}\\b${acao}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\bquero saber se\\b.{0,60}\\b${infinitivo}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (new RegExp(`\\bantes de\\b.{0,30}\\b${infinitivo}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel)) return false;
  if (textoClassificavel.endsWith("?") && /\b(?:automaticamente|quando|se)\b/.test(textoClassificavel)) return false;

  const prefixosDiretos = "(?:(?:bibble|ialpha)[,: ]+)?(?:por favor[,: ]+)?";
  const imperativoAtual = new RegExp(`^${prefixosDiretos}(?:me +)?(?:abra|crie|registre|faca)\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel);
  const coloquialInequivoco = new RegExp(`^${prefixosDiretos}(?:me +)?(?:abre|cria|registra|faz)\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel);
  const pedidoDireto = new RegExp(`^${prefixosDiretos}(?:(?:eu +)?(?:quero|preciso|gostaria|pode|podemos|vamos)|voce +pode)\\b.{0,50}\\b(?:${infinitivo}|abra|crie|registre|faca)\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel);
  const comandoCurto = new RegExp(`^${prefixosDiretos}(?:me +)?${infinitivo}\\b.{0,60}\\b${chamado}\\b`).test(textoClassificavel);
  return imperativoAtual || coloquialInequivoco || pedidoDireto || comandoCurto;
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
