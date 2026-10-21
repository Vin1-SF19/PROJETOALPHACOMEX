/* Cole em Extensões > Apps Script da planilha. Credenciais apenas nas Propriedades do script. */
var ALPHA_INSTAGRAM_SHEET = '1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI';

function sincronizarLeadsInstagram() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    var url = properties.getProperty('ALPHA_API_URL');
    var token = properties.getProperty('ALPHA_API_TOKEN');
    if (!url || !/^https:\/\/[^/]+\/rocket-api\/integrations\/instagram\/leads$/.test(url) || !token || token.length < 32) {
      throw new Error('Configure ALPHA_API_URL do NoLoss (HTTPS /rocket-api/integrations/instagram/leads) e ALPHA_API_TOKEN exclusivo do NoLoss.');
    }
    var spreadsheet = SpreadsheetApp.openById(ALPHA_INSTAGRAM_SHEET);
    var sheet = spreadsheet.getSheets().filter(function (tab) { return tab.getSheetId() === 0; })[0];
    if (!sheet) throw new Error('Aba de gid=0 não encontrada.');
    var rows = sheet.getDataRange().getDisplayValues();
    if (rows.length < 2) return;
    var headers = rows[0].map(function (v) { return v.trim(); });
    ['id', 'created_time', 'full_name', 'status_crm'].forEach(function (name) {
      if (headers.indexOf(name) < 0 || headers.indexOf(name) !== headers.lastIndexOf(name)) throw new Error('Cabeçalho ausente ou duplicado: ' + name);
    });
    var idColumn = headers.indexOf('id');
    var statusColumn = headers.indexOf('status_crm');
    var host = url.split('/')[2];
    if (!properties.getProperty('ALPHA_NOLOSS_INICIO_' + host)) {
      throw new Error('Execute instalarSincronizacaoInstagram primeiro. A ativação preserva o histórico e envia somente novos IDs.');
    }
    var cursorKey = 'ALPHA_CURSOR_' + host;
    var inicio = Number(properties.getProperty(cursorKey) || 1);
    if (!isFinite(inicio) || inicio < 1 || inicio >= rows.length) inicio = 1;
    var tentativas = 0;
    var deadline = Date.now() + 240000;
    for (var offset = 0; offset < rows.length - 1 && tentativas < 25 && Date.now() < deadline; offset++) {
      var index = 1 + ((inicio - 1 + offset) % (rows.length - 1));
      var row = rows[index];
      var externalId = String(row[idColumn] || '').trim();
      properties.setProperty(cursorKey, String(index + 1));
      if (!externalId) continue;
      if (properties.getProperty('ALPHA_NOLOSS_IGNORAR_' + host + ':' + externalId) === '1') continue;
      var sucesso = 'integrado@' + host + ':' + externalId;
      var ignorado = 'teste-ignorado@' + host + ':' + externalId;
      if (row[statusColumn] === sucesso || row[statusColumn] === ignorado) continue;
      var lead = {};
      headers.forEach(function (name, column) { if (name && name !== 'status_crm') lead[name] = String(row[column] || ''); });
      tentativas++;
      var response;
      try {
        response = UrlFetchApp.fetch(url, {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify({ spreadsheetId: ALPHA_INSTAGRAM_SHEET, sheetId: 0, lead: lead }),
          muteHttpExceptions: true, followRedirects: false,
        });
      } catch (error) {
        // Sem confirmação: não marcar entregue. Próxima execução reenvia o mesmo ID.
        properties.setProperty(cursorKey, String(index));
        break;
      }
      var code = response.getResponseCode();
      var result = {};
      try { result = JSON.parse(response.getContentText()); } catch (error) { /* resposta inválida não confirma entrega */ }
      var confirmado = code >= 200 && code < 300 && result.success === true && result.externalId === externalId
        && (typeof result.leadId === 'string' || result.ignored === true);
      var status = confirmado ? (result.ignored === true ? ignorado : sucesso) : 'erro@' + host + ':HTTP_' + code;
      // Resolve pelo ID novamente para não escrever o status na linha de outro lead após uma ordenação.
      var encontrados = sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1).createTextFinder(externalId).matchEntireCell(true).findAll();
      if (encontrados.length === 1 && sheet.getRange(encontrados[0].getRow(), idColumn + 1).getDisplayValue().trim() === externalId) {
        sheet.getRange(encontrados[0].getRow(), statusColumn + 1).setValue(status);
      }
      if (!confirmado && (code === 401 || code === 403 || code === 429 || code >= 500 || code < 200 || code >= 300 && code < 400 || code >= 200 && code < 300)) {
        properties.setProperty(cursorKey, String(index));
        break;
      }
    }
  } finally { lock.releaseLock(); }
}

function instalarSincronizacaoInstagram() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Aguarde a sincronização atual terminar.');
  try {
    var properties = PropertiesService.getScriptProperties();
    var url = properties.getProperty('ALPHA_API_URL');
    var token = properties.getProperty('ALPHA_API_TOKEN');
    if (!url || !/^https:\/\/[^/]+\/rocket-api\/integrations\/instagram\/leads$/.test(url) || !token || token.length < 32) {
      throw new Error('Configure a URL e a credencial do NoLoss antes de ativar.');
    }
    var host = url.split('/')[2];
    if (!properties.getProperty('ALPHA_NOLOSS_INICIO_' + host)) {
      var sheet = SpreadsheetApp.openById(ALPHA_INSTAGRAM_SHEET).getSheets().filter(function (tab) { return tab.getSheetId() === 0; })[0];
      if (!sheet) throw new Error('Aba de gid=0 não encontrada.');
      var rows = sheet.getDataRange().getDisplayValues();
      var headers = rows.length ? rows[0].map(function (value) { return value.trim(); }) : [];
      var column = headers.indexOf('id');
      if (column < 0 || column !== headers.lastIndexOf('id') || headers.indexOf('status_crm') < 0) throw new Error('Confira os cabeçalhos id/status_crm.');
      var initial = {};
      rows.slice(1).forEach(function (row) {
        var id = String(row[column] || '').trim();
        if (id) initial['ALPHA_NOLOSS_IGNORAR_' + host + ':' + id] = '1';
      });
      // Falha antes de ativar se o histórico ultrapassar a margem de armazenamento do Apps Script.
      if (JSON.stringify(initial).length * 2 > 300000) throw new Error('Histórico muito grande para ativação automática; preparar um recorte revisado antes de ativar.');
      initial['ALPHA_NOLOSS_INICIO_' + host] = new Date().toISOString();
      properties.setProperties(initial, false);
    }
    // Gatilho por tempo também capta linhas acrescentadas por integrações/API do Meta.
    var existente = ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === 'sincronizarLeadsInstagram'; });
    if (!existente) ScriptApp.newTrigger('sincronizarLeadsInstagram').timeBased().everyMinutes(5).create();
  } finally { lock.releaseLock(); }
}
