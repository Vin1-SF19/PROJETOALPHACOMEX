# Google Meet — transcrições no Alpha CRM

O Alpha CRM consulta os artefatos pós-reunião pela Google Meet REST API. Ele usa a mesma
Service Account da Agenda Alpha, mas cria um cliente separado com apenas o escopo de leitura
`https://www.googleapis.com/auth/meetings.space.readonly`. Nenhuma credencial é enviada ao navegador.

## Configuração externa obrigatória

1. No Google Cloud, habilite a **Google Meet REST API** no projeto da Service Account.
2. Confirme que a Service Account está com **Domain-Wide Delegation** habilitada.
3. No Google Admin Console, abra **Segurança > Controle de acesso e dados > Controles de API > Delegação em todo o domínio**.
4. No Client ID da Service Account, acrescente o escopo exato `https://www.googleapis.com/auth/meetings.space.readonly`.
5. Mantenha no servidor `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY`. A chave aceita `\n` literais e nunca deve ser versionada.
6. Garanta que a edição e a política do Google Workspace permitam transcrição e ative a transcrição na reunião. O campo do CRM não cria uma transcrição que o Meet não gerou.

O usuário impersonado é sempre resolvido no servidor a partir do evento e do calendário que
organizaram a reunião. O responsável do card, a sessão atual e dados enviados pelo navegador
nunca são usados como identidade para a delegação.

## Operação e validação

- Depois de encerrar uma reunião de teste com transcrição habilitada, abra o card e use
  **Sincronizar transcrição**. Enquanto o Google processa o artefato, o estado correto é
  **Transcrição pendente**.
- O job protegido por `CRON_SECRET` também consulta até 50 reuniões pendentes por execução,
  antes de aplicar o ciclo de oito dias úteis.
- Um sucesso persiste o texto em `BpmCard.transcricaoReuniao`, registra auditoria sem copiar
  credenciais/payload bruto e publica a atualização em tempo real.
- Depois que a transcrição é recebida, a reunião passa a ser evidência concluída e não pode ser
  reagendada/reutilizada. Isso impede que um novo horário fique vinculado ao texto da conferência anterior.
- Erro 401/403 normalmente indica API, delegação ou escopo não configurado. A aplicação não
  deve registrar private key, token ou e-mail de participante nos logs.

Os conference records expiram no Google; valide a captura logo após a reunião. Quando um link
do Meet é reutilizado, o CRM escolhe somente a conferência encerrada compatível com a data do card.
