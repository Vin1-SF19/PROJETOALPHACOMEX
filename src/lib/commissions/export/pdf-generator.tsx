import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { PreviewResult } from "./preview-builder";

/**
 * Gera PDF A4 no FORMATO REAL do espelho usado pela empresa (validado contra PDFs de
 * referência "ESPELHO DE COMISSÕES"/"ESPELHO DE PRÊMIOS", 2026-07-30) via
 * `@react-pdf/renderer` — mesma lib já usada em `src/lib/bibble/gerar-ficha-server.ts`.
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  titulo: { fontSize: 14, fontWeight: "bold" },
  periodoBox: { position: "absolute", top: 32, right: 32, alignItems: "flex-end" },
  periodoLabel: { fontSize: 9, fontWeight: "bold" },
  periodoValor: { fontSize: 9, border: "1pt solid #000", padding: 3, marginTop: 2, minWidth: 90, textAlign: "center" },
  infoTable: { marginTop: 20, borderWidth: 1, borderColor: "#000" },
  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" },
  infoLabel: { width: "30%", fontSize: 9, fontWeight: "bold", padding: 4, borderRightWidth: 1, borderColor: "#000" },
  infoValor: { width: "70%", fontSize: 9, padding: 4 },
  tabela: { marginTop: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1F2937" },
  tableHeaderCell: { color: "#FFFFFF", fontSize: 8, fontWeight: "bold", padding: 5, textAlign: "center" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#D7DEE8" },
  tableRowZebra: { backgroundColor: "#F1F5F9" },
  cell: { fontSize: 8, padding: 5 },
  cellCentro: { fontSize: 8, padding: 5, textAlign: "center" },
  cellDireita: { fontSize: 8, padding: 5, textAlign: "right" },
  totaisBox: { marginTop: 12, alignSelf: "flex-end", width: "50%" },
  totaisRow: { flexDirection: "row", borderWidth: 1, borderColor: "#000", borderTopWidth: 0 },
  totaisLabel: { width: "60%", fontSize: 9, fontWeight: "bold", padding: 4, backgroundColor: "#F1F5F9" },
  totaisValor: { width: "40%", fontSize: 9, padding: 4, textAlign: "right" },
  totalFinalRow: { flexDirection: "row", borderWidth: 1, borderColor: "#000" },
  totalFinalLabel: { width: "60%", fontSize: 10, fontWeight: "bold", padding: 5, backgroundColor: "#000", color: "#FFFFFF" },
  totalFinalValor: { width: "40%", fontSize: 10, fontWeight: "bold", padding: 5, textAlign: "right", backgroundColor: "#000", color: "#FFFFFF" },
  assinatura: { marginTop: 60 },
  linhaAssinatura: { borderTopWidth: 1, borderColor: "#000", width: 260, textAlign: "center", paddingTop: 4, fontSize: 9, fontWeight: "bold" },
  rodape: { position: "absolute", bottom: 24, left: 32, fontSize: 7, color: "#64748B" },
});

function formatarDataPdf(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(data));
}

function formatarMoedaPdf(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface EspelhoPdfProps {
  preview: PreviewResult;
  codigoVerificacao: string;
}

function EspelhoPdfDocument({ preview, codigoVerificacao }: EspelhoPdfProps) {
  const titulo = preview.tipo === "comissoes" ? "ESPELHO DE COMISSÕES" : "ESPELHO DE PRÊMIOS";
  const colunas =
    preview.tipo === "comissoes" ? ["Data", "Empresa", "Comissão", "DSR", "Total"] : ["Data", "Empresa", "Êxito", "De Primeira", "Total"];
  const linhas = preview.tipo === "comissoes" ? preview.linhasComissao : preview.linhasPremio;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>{titulo}</Text>

        <View style={styles.periodoBox}>
          <Text style={styles.periodoLabel}>PERÍODO DE REFERÊNCIA</Text>
          <View style={{ flexDirection: "row", marginTop: 2 }}>
            <Text style={{ fontSize: 8, marginRight: 4 }}>DE</Text>
            <Text style={styles.periodoValor}>{formatarDataPdf(preview.periodoInicio)}</Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 2 }}>
            <Text style={{ fontSize: 8, marginRight: 4 }}>ATÉ</Text>
            <Text style={styles.periodoValor}>{formatarDataPdf(preview.periodoFim)}</Text>
          </View>
        </View>

        <View style={styles.infoTable}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CARGO</Text>
            <Text style={styles.infoValor}>{preview.cargoNome ?? "--"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>COLABORADOR</Text>
            <Text style={styles.infoValor}>{preview.colaboradorNome}</Text>
          </View>
        </View>

        <View style={styles.tabela}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>{colunas[0]}</Text>
            <Text style={[styles.tableHeaderCell, { width: "46%" }]}>{colunas[1]}</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>{colunas[2]}</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>{colunas[3]}</Text>
            <Text style={[styles.tableHeaderCell, { width: "14%" }]}>{colunas[4]}</Text>
          </View>

          {linhas.map((linha, index) => {
            const valores =
              preview.tipo === "comissoes"
                ? [(linha as (typeof preview.linhasComissao)[number]).comissaoCents, (linha as (typeof preview.linhasComissao)[number]).dsrCents]
                : [(linha as (typeof preview.linhasPremio)[number]).exitoCents, (linha as (typeof preview.linhasPremio)[number]).primeiraCents];

            return (
              <View key={linha.entryId} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowZebra : {}]} wrap={false}>
                <Text style={[styles.cellCentro, { width: "12%" }]}>{formatarDataPdf(linha.data)}</Text>
                <Text style={[styles.cell, { width: "46%" }]}>{linha.empresaNome}</Text>
                <Text style={[styles.cellDireita, { width: "14%" }]}>{formatarMoedaPdf(valores[0])}</Text>
                <Text style={[styles.cellDireita, { width: "14%" }]}>{formatarMoedaPdf(valores[1])}</Text>
                <Text style={[styles.cellDireita, { width: "14%" }]}>{formatarMoedaPdf(linha.totalCents)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totaisBox}>
          {preview.tipo === "comissoes" ? (
            <>
              <View style={styles.totaisRow}>
                <Text style={styles.totaisLabel}>COMISSÃO</Text>
                <Text style={styles.totaisValor}>{formatarMoedaPdf(preview.totais.comissaoCents)}</Text>
              </View>
              <View style={styles.totaisRow}>
                <Text style={styles.totaisLabel}>DSR</Text>
                <Text style={styles.totaisValor}>{formatarMoedaPdf(preview.totais.dsrCents)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.totaisRow}>
                <Text style={styles.totaisLabel}>PRÊMIOS POR ÊXITO</Text>
                <Text style={styles.totaisValor}>{formatarMoedaPdf(preview.totais.exitoCents)}</Text>
              </View>
              <View style={styles.totaisRow}>
                <Text style={styles.totaisLabel}>PRÊMIOS POR DEFERIMENTO DE PRIMEIRA</Text>
                <Text style={styles.totaisValor}>{formatarMoedaPdf(preview.totais.primeiraCents)}</Text>
              </View>
            </>
          )}
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalFinalLabel}>TOTAL</Text>
            <Text style={styles.totalFinalValor}>{formatarMoedaPdf(preview.totais.totalGeralCents)}</Text>
          </View>
        </View>

        <View style={styles.assinatura}>
          <Text style={styles.linhaAssinatura}>{preview.colaboradorNome}</Text>
          <Text style={{ fontSize: 8, textAlign: "center", fontStyle: "italic", marginTop: 2 }}>Assinatura</Text>
        </View>

        <Text style={styles.rodape}>
          Documento emitido em {formatarDataPdf(new Date())} · Código de verificação: {codigoVerificacao}
        </Text>
      </Page>
    </Document>
  );
}

export async function gerarPdfEspelho(params: EspelhoPdfProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<EspelhoPdfDocument {...params} />);
  return Buffer.from(buffer);
}
