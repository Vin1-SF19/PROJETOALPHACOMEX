import { describe, expect, it } from "vitest";
import { detectarParserExtrato, obterParser } from "@/lib/extrato/parsers";

const AMOSTRAS: Array<{ banco: string; texto: string; esperado: Array<[string, string, number]> }> = [
  {
    banco: "c6",
    texto: `Extrato Período • 1 de agosto de 2026 até 31 de agosto de 2026\nCheque Especial contratado • R$ 1.000,00\nData lançamento Data contábil Tipo Descrição Valor\n01/08 03/08 Entrada PIX Pix recebido de CLIENTE R$ 660,87\n02/08 03/08 Saída PIX Pix enviado para FORNECEDOR -R$ 3.000,00\nSaldo do dia 03/08/26 R$ 500,00`,
    esperado: [["01/08/2026", "ENTRADA PIX PIX RECEBIDO DE CLIENTE", 660.87], ["02/08/2026", "SAÍDA PIX PIX ENVIADO PARA FORNECEDOR", -3000]],
  },
  {
    banco: "credcrea",
    texto: `Cooperativa: CREDCREA | Banco: 085\nSALDO (R$) DÉBITO (R$) DESCRIÇÃO CRÉDITO (R$) DATA DOCUMENTO\nSALDO ANTERIOR 100,00\nVENDA CARTAO (ANT) 01/08/2023 146,44 246,44 69\nDEBITO PIX - CLIENTE 01/08/2023 -50,00 196,44 274101.092`,
    esperado: [["01/08/2023", "VENDA CARTAO (ANT)", 146.44], ["01/08/2023", "DEBITO PIX - CLIENTE", -50]],
  },
  {
    banco: "inter",
    texto: `Instituição: Banco Inter\nValor Saldo por transação\n3 de Agosto de 2026 Saldo do dia: R$ 100,00\nPix recebido: "CLIENTE" R$ 200,00 R$ 300,00\nAplicacao: "CDB" -R$ 100,00 R$ 200,00`,
    esperado: [["03/08/2026", "PIX RECEBIDO: \"CLIENTE\"", 200], ["03/08/2026", "APLICACAO: \"CDB\"", -100]],
  },
  {
    banco: "sicoob",
    texto: `SICOOB\nEXTRATO CONTA CORRENTE\nPERÍODO: 01/07/2026 - 31/07/2026\nHISTÓRICO DE MOVIMENTAÇÃO\n30/06 SALDO ANTERIOR 100,00C\n01/07 PIX RECEB.OUTRA IF 200,00C\n01/07 PIX EMIT.OUTRA IF 50,00D\n01/07 SALDO DO DIA 250,00C`,
    esperado: [["01/07/2026", "PIX RECEB.OUTRA IF", 200], ["01/07/2026", "PIX EMIT.OUTRA IF", -50]],
  },
  {
    banco: "bancoBrasil",
    texto: `Consultas - Extrato de conta corrente\nBB Rende Fácil\n01/07/2026 0000 00000 000 Saldo Anterior 100,00 C\n06/07/2026 0000 13113 435 Tarifa Pacote de Serviços 831.871.103.411.077 93,10 D\n06/07/2026 0000 00000 798 BB Rende Fácil 9.903 93,10 C 0,00 C`,
    esperado: [["06/07/2026", "TARIFA PACOTE DE SERVIÇOS", -93.1], ["06/07/2026", "BB RENDE FÁCIL", 93.1]],
  },
  {
    banco: "pagBank",
    texto: `PagSeguro Internet S/A\nDescrição Data Valor\n01/08/2026 Pix enviado - FORNECEDOR -R$ 100,00\nSaldo do dia 01/08/2026 R$ 500,00\n02/08/2026 Pix recebido - CLIENTE R$ 50,00`,
    esperado: [["01/08/2026", "PIX ENVIADO - FORNECEDOR", -100], ["02/08/2026", "PIX RECEBIDO - CLIENTE", 50]],
  },
  {
    banco: "sicredi",
    texto: `Sicredi\nData Descrição Documento Valor (R$) Saldo (R$)\nSALDO ANTERIOR 100,00\n03/08/2026 PAGAMENTO PIX CLIENTE PIX_DEB -30,00 70,00\n03/08/2026 RECEBIMENTO PIX CLIENTE PIX_CRED 50,00 120,00`,
    esperado: [["03/08/2026", "PAGAMENTO PIX CLIENTE PIX_DEB", -30], ["03/08/2026", "RECEBIMENTO PIX CLIENTE PIX_CRED", 50]],
  },
  {
    banco: "nubank",
    texto: `NU PAGAMENTOS\nSaldo final do período\nR$ 100,00\nMovimentações\n01 JUN 2026 Total de saídas - 30,00\nTransferência enviada pelo Pix CLIENTE\n30,00\nSaldo do dia 70,00\nSaldo final do período\nR$ 70,00\nMovimentações\n01 JUL 2026 Total de entradas + 50,00\nTransferência recebida pelo Pix CLIENTE 50,00`,
    esperado: [["01/06/2026", "TRANSFERÊNCIA ENVIADA PELO PIX CLIENTE", -30], ["01/07/2026", "TRANSFERÊNCIA RECEBIDA PELO PIX CLIENTE", 50]],
  },
];

describe("layouts das amostras de setembro", () => {
  for (const { banco, texto, esperado } of AMOSTRAS) {
    it(`identifica e interpreta ${banco}`, () => {
      expect(detectarParserExtrato(texto)?.bancoId).toBe(banco);
      expect(obterParser(banco).parse(texto).map(({ data, descricao, valor }) => [data, descricao, valor])).toEqual(esperado);
    });
  }

  it("exclui a seção de saldos de investimento do Bradesco", () => {
    const texto = `Data Lançamento Dcto. Crédito (R$) Débito (R$) Saldo (R$)\n31/07/2026 SALDO ANTERIOR 200,00\n03/08/2026 PIX RECEBIDO 1234567 100,00 300,00\nTotal 100,00 0,00 300,00\nSaldos Invest Fácil / Plus\n03/08/2026 SALDO INVEST FÁCIL 300,00`;
    expect(obterParser("bradesco").parse(texto).map(({ valor }) => valor)).toEqual([100]);
  });

  it("preserva lançamentos da legenda e a data dentro da descrição no Itaú consolidado", () => {
    const texto = `extrato mensal ag 0000 cc 00000-0 ago 2026 001|010\nConta Corrente | Movimentação\nA = agendamento data descrição entradas R$ saídas R$ saldo R$\nD = débito a compensar 03/08 Sispag Fornecedores 300,00-\nG = aplicação programada Sispag Fornecedores 404,48-\nP = poupança automática Sispag Fornecedores 859,57-\nPara demais siglas, consulte as Notas Sispag Fornecedores 300,00-\nExplicativas no final do extrato Sispag Fornecedores 300,00-\n17/08 PIX TRANSF CLIENTE 17/08 107.169,79\nSaldo em C/C 1,00`;
    expect(obterParser("itau").parse(texto).map(({ valor }) => valor)).toEqual([-300, -404.48, -859.57, -300, -300, 107169.79]);
  });

  it("processa todos os meses de um PDF Santander concatenado", () => {
    const mes = (nome: string, dia: string) => `EXTRATO CONSOLIDADO INTELIGENTE\n${nome}/2026\nConta Corrente\nMovimentação\nData Descrição Nº Documento Movimentos (R$) Saldo (R$)\nCréditos Débitos\n${dia} PIX RECEBIDO 123456 - 100,00\nSaldos por Período`;
    const resultado = obterParser("santander").parse(`${mes("junho", "01/06")}\n${mes("julho", "01/07")}`);
    expect(resultado.map(({ data }) => data)).toEqual(["01/06/2026", "01/07/2026"]);
  });
});
