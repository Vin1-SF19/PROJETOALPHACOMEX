import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("scripts/google-sheets-instagram.gs", "utf8");
function montar(respostas: Array<{ code: number; body: unknown } | Error>) {
  const rows = [["id", "created_time", "full_name", "status_crm"], ["l:exemplo", "2026-10-21T12:00:00Z", "Contato Exemplo", "integrado"]];
  const props: Record<string, string> = { ALPHA_API_URL: "https://noloss.alpha-comex.com/rocket-api/integrations/instagram/leads", ALPHA_API_TOKEN: "a".repeat(43) };
  props['ALPHA_NOLOSS_INICIO_noloss.alpha-comex.com'] = '2026-10-21T12:00:00Z';
  const writes: Array<{ row: number; column: number; value: string }> = [];
  const release = vi.fn();
  const sheet = {
    getSheetId: () => 0, getLastRow: () => rows.length, getDataRange: () => ({ getDisplayValues: () => rows.map((r) => [...r]) }),
    getRange: (row: number, column: number, count?: number) => count === undefined
      ? { getDisplayValue: () => rows[row - 1][column - 1], setValue: (value: string) => { rows[row - 1][column - 1] = value; writes.push({ row, column, value }); } }
      : { createTextFinder: (id: string) => ({ matchEntireCell: () => ({ findAll: () => rows.flatMap((r, index) => index > 0 && r[column - 1] === id ? [{ getRow: () => index + 1 }] : []) }) }) },
  };
  const fetch = vi.fn().mockImplementation(() => {
    const response = respostas.shift(); if (response instanceof Error) throw response;
    if (!response) throw new Error("Sem resposta simulada");
    return { getResponseCode: () => response.code, getContentText: () => JSON.stringify(response.body) };
  });
  const context: Record<string, unknown> = {
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: release }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => props[key], setProperty: (key: string, value: string) => { props[key] = value; }, setProperties: (values: Record<string, string>) => Object.assign(props, values) }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet] }) }, UrlFetchApp: { fetch },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: vi.fn() }) }) }) },
  };
  runInNewContext(source, context);
  const run = () => (context.sincronizarLeadsInstagram as () => void)();
  return { run, install: () => (context.instalarSincronizacaoInstagram as () => void)(), fetch, rows, writes, release, props };
}

describe("remetente Apps Script", () => {
  it("recusa destino CRM direto e não envia antes da ativação do NoLoss", () => {
    const test = montar([]);
    test.props.ALPHA_API_URL = 'https://painel.alpha-comex.com/api/integrations/instagram/leads';
    expect(test.run).toThrow('NoLoss');
    test.props.ALPHA_API_URL = 'https://noloss.alpha-comex.com/rocket-api/integrations/instagram/leads';
    delete test.props['ALPHA_NOLOSS_INICIO_noloss.alpha-comex.com'];
    expect(test.run).toThrow('instalarSincronizacaoInstagram');
    expect(test.fetch).not.toHaveBeenCalled();
  });
  it("ativação preserva histórico mesmo após ordenação e reinstalação; só IDs novos são enviados", () => {
    const test = montar([{ code: 200, body: { success: true, externalId: 'l:novo', leadId: 'cnovo' } }]);
    delete test.props['ALPHA_NOLOSS_INICIO_noloss.alpha-comex.com'];
    test.install(); test.run();
    expect(test.fetch).not.toHaveBeenCalled();
    test.rows.splice(1, 0, ['l:novo', '2026-10-21T13:00:00Z', 'Novo exemplo', '']);
    test.install(); test.run();
    expect(test.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(test.fetch.mock.calls[0][1].payload).lead.id).toBe('l:novo');
    expect(test.rows.find((row) => row[0] === 'l:exemplo')?.[3]).toBe('integrado');
    expect(test.writes).toHaveLength(1);
  });
  it("não confia em integrado legado, envia IDs texto e confirma somente após sucesso correspondente", () => {
    const test = montar([{ code: 201, body: { success: true, externalId: "l:exemplo", leadId: "cvirtual" } }]);
    test.run();
    const options = test.fetch.mock.calls[0][1];
    expect(JSON.parse(options.payload)).toMatchObject({ sheetId: 0, lead: { id: "l:exemplo" } });
    expect(options.followRedirects).toBe(false);
    expect(test.rows[1][3]).toBe("integrado@noloss.alpha-comex.com:l:exemplo");
    expect(test.writes).toHaveLength(1); expect(test.writes[0].column).toBe(4);
    test.run(); expect(test.fetch).toHaveBeenCalledTimes(1);
    expect(test.release).toHaveBeenCalledTimes(2);
  });
  it("timeout não marca entrega; a próxima execução reenvia o mesmo ID", () => {
    const test = montar([new Error("timeout"), { code: 200, body: { success: true, externalId: "l:exemplo", leadId: "cvirtual", duplicate: true } }]);
    test.run(); expect(test.writes).toHaveLength(0);
    test.run(); expect(test.rows[1][3]).toContain("integrado@"); expect(test.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([429, 503])("HTTP %s não confirma entrega e permite retry", (code) => {
    const test = montar([{ code, body: { success: false } }]); test.run();
    expect(test.rows[1][3]).toContain("erro@"); expect(test.rows[1][3]).not.toContain("integrado@");
    expect(test.release).toHaveBeenCalled();
  });
  it("erro permanente de uma linha não impede a entrega de um novo lead posterior", () => {
    const test = montar([{ code: 422, body: { success: false, code: 'CRM_DADOS_RECUSADOS' } },
      { code: 200, body: { success: true, externalId: 'l:novo', leadId: 'cnovo' } }]);
    test.rows.push(['l:novo', '2026-10-21T13:00:00Z', 'Novo exemplo', '']);
    test.run();
    expect(test.fetch).toHaveBeenCalledTimes(2);
    expect(test.rows[1][3]).toContain('erro@');
    expect(test.rows[2][3]).toBe('integrado@noloss.alpha-comex.com:l:novo');
  });
  it("sucesso com outro externalId nunca confirma esta linha", () => {
    const test = montar([{ code: 200, body: { success: true, externalId: "l:outro", leadId: "cvirtual" } }]); test.run();
    expect(test.rows[1][3]).not.toContain("integrado@");
  });
});
