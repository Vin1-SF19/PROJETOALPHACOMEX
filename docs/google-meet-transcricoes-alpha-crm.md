# Google Meet — transcrições e resumos no Alpha CRM

O CRM lê transcrições pela Google Meet REST API e mostra os links das notas geradas pelo Gemini. O texto transcrito fica no card; o link do resumo abre o Google Docs sob as permissões do próprio Google. Uma descrição de evento ou um resumo não substitui a transcrição exigida para avançar de Reunião Agendada para Em tratativas ou Sem viabilidade.

## 1. Preparar o Google Workspace

1. Confirme que a conta que organiza as reuniões possui uma edição do Workspace que inclui transcrição do Meet. Verifique também armazenamento disponível no Drive do organizador. A lista atual de edições elegíveis está na [ajuda oficial de transcrição](https://support.google.com/meet/answer/12849897).
2. Como administrador, acesse **Admin Console → Apps → Google Workspace → Google Meet → Meet video settings → Meeting transcription** e habilite a função para a unidade organizacional dos organizadores. Aguarde a propagação indicada pelo Google. Consulte o [procedimento oficial do administrador](https://knowledge.workspace.google.com/admin/meet/turn-meeting-transcription-on-or-off).
3. Se desejar que as próximas reuniões iniciem com transcrição automaticamente, configure **Automatic transcription** nas [configurações de artefatos automáticos](https://knowledge.workspace.google.com/admin/meet/choose-automatic-meeting-artifact-settings-for-your-organization). Sem essa opção, o organizador ou coorganizador precisa abrir a reunião e selecionar **Meeting tools → Transcribe → Start transcription**. A transcrição é independente da gravação de vídeo; não é preciso gravar para transcrever. [Referência do Google Meet](https://developers.google.com/workspace/meet/api/guides/artifacts).
4. Para obter **resumos**, confirme uma licença elegível para “Take notes for me” e habilite essa função no Admin Console, se disponível. Durante a reunião, o organizador inicia **Take notes for me** ou configura notas automáticas. Esse recurso gera um Google Docs separado; habilitar a transcrição não gera, por si só, um resumo do Gemini. [Ajuda do Google Meet](https://support.google.com/meet/answer/14754931).
5. Para também ter **gravação de vídeo**, habilite gravação nas configurações do Meet e inicie **Record meeting** na reunião ou configure gravação automática. O CRM mostra o link da gravação quando o Meet publicar o arquivo no Drive. A gravação é opcional para a transcrição. [Configuração de gravação](https://knowledge.workspace.google.com/admin/meet/turn-meet-recording-on-or-off-for-your-organization).

## 2. Autorizar a leitura pela aplicação

1. No projeto Google Cloud da Service Account usada pela Agenda Alpha, habilite **Google Meet REST API**.
2. Confirme **Domain-wide Delegation** na Service Account e copie o **Client ID numérico** dessa conta.
3. No Admin Console, acesse **Security → Access and data control → API controls → Domain-wide delegation**. Adicione ou edite esse Client ID com o escopo exato `https://www.googleapis.com/auth/meetings.space.readonly`. Não substitua os escopos já necessários à Agenda Alpha.
4. No servidor da aplicação, mantenha `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY`. A chave pode conter `\n` literais. Configure essas variáveis também no ambiente do deploy. Não coloque a chave no navegador, no Git ou em capturas de tela.
5. A aplicação identifica o usuário Google a impersonar pelo **calendário e evento organizadores** vinculados ao card. A conta organizadora precisa manter a Agenda Alpha ativa. O escopo somente leitura permite listar transcrições e smart notes; nenhuma permissão de escrita no Meet é exigida pela implementação atual. [Autenticação e delegação do Meet](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize).

## 3. Testar ponta a ponta

1. Crie uma reunião pelo card e confirme que ela foi para **Reunião Agendada**, com link Meet e calendário vinculados.
2. Entre com a conta organizadora elegível, ative **Transcribe** e, se desejado, **Take notes for me**. Fale algumas frases de teste e encerre a reunião para todos.
3. Aguarde o processamento do Google. No card, use **Sincronizar transcrição**. O estado **pendente** significa que o Google ainda não disponibilizou o artefato; **recebida** significa texto persistido no card; erro de autorização indica API, delegação, escopo ou conta organizadora incorretos.
4. Use **Buscar resumos e gravações do Google Meet**. Se houver smart notes ou gravações com arquivo pronto, o card mostrará links para o Google Docs ou Drive. A conta que abrir o link precisa ter acesso ao arquivo.
5. Teste o avanço para **Em tratativas** com e sem transcrição. Sem texto transcrito, o servidor deve bloquear. **Stand By** continua disponível para contingência e para o fim da cadência.

## Diagnóstico e limites

- Se o Google Docs da transcrição não existir, confira licença, opção do administrador, início efetivo da transcrição durante a reunião e espaço no Drive. O CRM não cria texto a partir de áudio quando o Google não o gerou.
- Se não aparecer resumo, confira a licença e o início de “Take notes for me”; o recurso é distinto da transcrição. Os links só aparecem após o Google gerar o arquivo. [Smart notes na API](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.smartNotes).
- Erros `401/403` na sincronização pedem revisão da API habilitada, Client ID da delegação, scope e organizador. Não troque a identidade impersonada pelo usuário que apenas abriu o card.
- A API do Meet retém as **entradas estruturadas da transcrição por 30 dias** após o fim da conferência. O job do CRM e a sincronização manual devem ocorrer nesse prazo; o arquivo do Drive segue as próprias regras de retenção. [Retenção dos artefatos](https://developers.google.com/workspace/meet/api/guides/artifacts).
- O job protegido por `CRON_SECRET` consulta reuniões pendentes. Um sucesso registra auditoria e atualização em tempo real. Após a transcrição, o mesmo evento não pode ser reagendado, preservando o vínculo da evidência com a conferência original.
