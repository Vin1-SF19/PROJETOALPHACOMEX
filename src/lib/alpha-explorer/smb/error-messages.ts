import { SmbGatewayError } from "./browser-client";

const FRIENDLY_SMB_ERRORS: Readonly<Record<string, string>> = {
  SMB_AUTHENTICATION_FAILED: "O QNAP recusou o usuário ou a senha. Use o nome exato da conta local do QNAP e confirme a senha.",
  SMB_ACCOUNT_LOCKED: "A conta está bloqueada no QNAP. Desbloqueie-a no painel do NAS e tente novamente.",
  SMB_PASSWORD_EXPIRED: "A senha dessa conta expirou ou precisa ser alterada diretamente no QNAP.",
  SMB_NO_ACCESSIBLE_SHARES: "A conta foi autenticada, mas não possui acesso a nenhuma pasta compartilhada disponível no Alpha Explorer.",
  SMB_SECURITY_INCOMPATIBLE: "A configuração de segurança SMB do QNAP não é compatível com o gateway. Verifique SMB3 e assinatura no NAS.",
  SMB_CONNECTION_TIMEOUT: "O QNAP demorou demais para responder. Verifique a rede e tente novamente.",
  SMB_CONNECTION_UNAVAILABLE: "O QNAP está indisponível ou recusou a conexão SMB neste momento.",
  SMB_CREDENTIAL_REJECTED: "Não foi possível validar essa conta no QNAP. Confira o usuário, a senha e o acesso às pastas compartilhadas.",
  SMB_PRINCIPAL_POLICY_DENIED: "Essa conta administrativa do QNAP não pode ser vinculada. Utilize uma conta nominal do usuário.",
  SMB_PRINCIPAL_ALREADY_LINKED: "Essa conta QNAP já está vinculada a outro usuário do Painel Alpha.",
  SMB_BINDING_ALREADY_EXISTS: "Este usuário já possui uma conta QNAP vinculada. Use a opção de rotacionar a senha.",
  SMB_GATEWAY_FAILED: "O gateway do QNAP não conseguiu concluir a operação.",
  SMB_PREVIEW_UNSUPPORTED: "Este tipo de arquivo não possui visualização no navegador. Use a opção Baixar.",
  PREVIEW_POPUP_BLOCKED: "O navegador bloqueou a nova aba. Permita pop-ups para abrir o arquivo.",
  FILE_SYSTEM_ACCESS_REQUIRED: "Este navegador não oferece o salvamento direto. Use Chrome ou Edge para baixar o arquivo.",
  OFFICE_FILE_UNSUPPORTED: "Este arquivo não pode ser aberto diretamente no Word ou Excel.",
  OFFICE_FILE_DENIED: "O QNAP recusou a abertura deste documento no aplicativo.",
  OFFICE_FILE_CHANGED: "O documento mudou desde a listagem. Atualize a pasta e tente novamente.",
  OFFICE_SESSION_NOT_FOUND: "O acesso temporário ao documento expirou. Abra o arquivo novamente pelo Alpha Explorer.",
  OFFICE_APPLICATION_MISMATCH: "O aplicativo indicado para este documento não corresponde ao formato do arquivo.",
  OFFICE_DOCUMENT_URL_INVALID: "O endereço temporário do documento é inválido.",
  FILE_NOT_FOUND: "O arquivo não foi encontrado no QNAP. Atualize a pasta e tente novamente.",
  RATE_LIMITED: "Foram feitas muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
};

export function friendlySmbErrorMessage(error: unknown): string {
  if (!(error instanceof SmbGatewayError)) {
    return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  }
  const message = FRIENDLY_SMB_ERRORS[error.code] ?? "Não foi possível concluir a operação no QNAP.";
  return error.supportId ? `${message} Referência para o suporte: ${error.supportId}.` : message;
}
