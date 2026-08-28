import { describe, expect, it } from "vitest";

import {
  detectarParserExtrato,
  obterParser,
} from "@/lib/extrato/parsers";

const ITAU_SIMPLIFICADO = `
EMPRESA EXEMPLO LTDA CNPJ 00.000.000/0001-00 Agência 0000 Conta 0000000-0
Lançamentos do período: 01/07/2026 até 31/07/2026
Data Lançamentos Razão Social CNPJ/CPF Valor (R$) Saldo (R$)
31/07/2026 SALDO TOTAL DISPONÍVEL DIA 10.000,00
31/07/2026 SISPAG FORNECEDORES PIX QR-
CODE -1.000,00
31/07/2026 PIX RECEBIDO EXEMPLO31/07 EMPRESA EXEMPLO
LTDA 00.000.000/0001-00 5.000,00
30/07/2026 SALDO TOTAL DISPONÍVEL DIA 6.000,00
30/07/2026 RENDIMENTOS REND PAGO APLIC
AUT MAIS 2,50
SISPAG FORNECEDORES PIX QR-
29/07/2026 CODE -500,00
29/07/2026 SALDO TOTAL DISPONÍVEL DIA 6.497,50
`;

const SANTANDER_CONSOLIDADO = `
EXTRATO CONSOLIDADO INTELIGENTE
junho/2026
Conta Corrente
Movimentação
Data Descrição Nº Documento Movimentos (R$) Saldo (R$)
Créditos Débitos
SALDO EM 31/05 0,00
01/06 PIX RECEBIDO 11111111111 - 250,00
PIX RECEBIDO 22222222222 - 50,00
APLICACAO CONTAMAX - 300,00- 0,00
02/06 PIX ENVIADO
FORNECEDOR EXEMPLO
- 120,00-
RESGATE CONTAMAX AUTOMATICO - 120,00 0,00
03/06 TARIFA MENSALIDADE PACOTE SERVICOS
MAIO / 2026
- 10,00-
SALDO EM 30/06 0,00
Saldos por Período
03 0,00 0,00 0,00 0,00 0,00 999,00 999,00
Comprovantes de Pagamento
03/06 INTERNET BANKING PIX FORNECEDOR EXEMPLO 99999999 0000 0000000000000 120,00
`;

const ITAU_MENSAL = `
extrato mensal ag 0000 cc 00000-0 jul 2026 001|004
Conta Corrente | Movimentação A = agendamento data descrição entradas R$ saídas R$ saldo R$
B = ações movimentadas (créditos) (débitos) pela Bolsa de Valores 23/06 Saldo anterior 0,08
C = crédito a compensar D = débito a compensar 06/07 PIX TRANSF PESSOA EXEMPLO04/07 240,80
G = aplicação programada Apl Aplic Aut Mais 239,88- 1,00 P = poupança automática SALDO APLIC AUT MAIS 239,88
14/07 PIX ENVIADO FAVORECIDO EXEMPLO 66,00-
data descrição entradas R$ saídas R$ saldo R$
Res Aplic Aut Mais 66,00 1,00
SALDO APLIC AUT MAIS 173,88
Saldo em C/C 1,00
Conta Corrente | Aplicações Automáticas
06/07 239,88 0,00 0,00 0,00 0,00 0,00 239,88
`;

describe("parsers de extratos validados contra PDFs reais", () => {
  it("recompõe linhas e quebras de página do Itaú simplificado", () => {
    expect(obterParser("itau").parse(ITAU_SIMPLIFICADO)).toEqual([
      {
        data: "31/07/2026",
        descricao: "SISPAG FORNECEDORES PIX QR- CODE",
        valor: -1_000,
      },
      {
        data: "31/07/2026",
        descricao: "PIX RECEBIDO EXEMPLO31/07 EMPRESA EXEMPLO LTDA",
        valor: 5_000,
      },
      {
        data: "30/07/2026",
        descricao: "RENDIMENTOS REND PAGO APLIC AUT MAIS",
        valor: 2.5,
      },
      {
        data: "29/07/2026",
        descricao: "SISPAG FORNECEDORES PIX QR- CODE",
        valor: -500,
      },
    ]);
  });

  it("herda datas, resolve o ano e interpreta o sinal final do Santander", () => {
    expect(obterParser("santander").parse(SANTANDER_CONSOLIDADO)).toEqual([
      { data: "01/06/2026", descricao: "PIX RECEBIDO", valor: 250 },
      { data: "01/06/2026", descricao: "PIX RECEBIDO", valor: 50 },
      { data: "01/06/2026", descricao: "APLICACAO CONTAMAX", valor: -300 },
      {
        data: "02/06/2026",
        descricao: "PIX ENVIADO FORNECEDOR EXEMPLO",
        valor: -120,
      },
      {
        data: "02/06/2026",
        descricao: "RESGATE CONTAMAX AUTOMATICO",
        valor: 120,
      },
      {
        data: "03/06/2026",
        descricao: "TARIFA MENSALIDADE PACOTE SERVICOS MAIO / 2026",
        valor: -10,
      },
    ]);
  });

  it("lê o extrato mensal do Itaú com lançamento dividido entre páginas", () => {
    expect(obterParser("itau").parse(ITAU_MENSAL)).toEqual([
      { data: "06/07/2026", descricao: "PIX TRANSF PESSOA EXEMPLO04/07", valor: 240.8 },
      { data: "06/07/2026", descricao: "APL APLIC AUT MAIS", valor: -239.88 },
      { data: "14/07/2026", descricao: "PIX ENVIADO FAVORECIDO EXEMPLO", valor: -66 },
      { data: "14/07/2026", descricao: "RES APLIC AUT MAIS", valor: 66 },
    ]);
  });

  it("autodetecta apenas as assinaturas validadas e preserva o fallback", () => {
    expect(detectarParserExtrato(ITAU_SIMPLIFICADO)?.bancoId).toBe("itau");
    expect(detectarParserExtrato(ITAU_MENSAL)?.bancoId).toBe("itau");
    expect(detectarParserExtrato(SANTANDER_CONSOLIDADO)?.bancoId).toBe("santander");
    expect(detectarParserExtrato("extrato de outro banco sem assinatura")).toBeNull();
    expect(obterParser("banco-inexistente").parse("texto sem transações")).toEqual([]);
  });
});
