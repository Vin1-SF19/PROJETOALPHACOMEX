import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { LinhaEspelho, PreviewResult } from "./preview-builder";

/**
 * Gera PDF A4 do espelho (seção 24 do prompt original) via `@react-pdf/renderer` — mesma
 * lib já usada em `src/lib/bibble/gerar-ficha-server.ts`/`src/components/GerarFicha.tsx`
 * para geração server-side de PDF no projeto.
 */

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 8 },
  header: { marginBottom: 12, borderBottomWidth: 1, borderColor: "#0F172A", paddingBottom: 8 },
  titulo: { fontSize: 14, fontWeight: "bold", textTransform: "uppercase" },
  subtitulo: { fontSize: 9, color: "#475569", marginTop: 2 },
  metaLinha: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, fontSize: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0F172A", paddingVertical: 4 },
  tableHeaderCell: { color: "#FFFFFF", fontSize: 7, fontWeight: "bold", paddingHorizontal: 3 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#D7DEE8", paddingVertical: 3 },
  tableRowZebra: { backgroundColor: "#F1F5F9" },
  cell: { fontSize: 7, paddingHorizontal: 3 },
  footer: { marginTop: 12, borderTopWidth: 1, borderColor: "#0F172A", paddingTop: 8 },
  footerLinha: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, marginTop: 2 },
  footerTotal: { fontSize: 10, fontWeight: "bold" },
});

const COLUNAS: Array<{ key: keyof LinhaEspelho | "colaborador"; label: string; width: string }> = [
  { key: "data", label: "Data", width: "8%" },
  { key: "cnpj", label: "CNPJ", width: "12%" },
  { key: "razaoSocial", label: "Razão Social", width: "18%" },
  { key: "servico", label: "Serviço", width: "14%" },
  { key: "evento", label: "Evento", width: "10%" },
  { key: "colaborador", label: "Colaborador", width: "14%" },
  { key: "comissaoCents", label: "Comissão", width: "8%" },
  { key: "dsrCents", label: "DSR", width: "6%" },
  { key: "premioCents", label: "Prêmio", width: "6%" },
  { key: "totalCents", label: "Total", width: "8%" },
];

function formatarDataPdf(data: Date | string | null): string {
  if (!data) return "--";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
}

function formatarMoedaPdf(cents: number | null): string {
  if (cents === null) return "--";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valorDaLinha(linha: LinhaEspelho, key: (typeof COLUNAS)[number]["key"]): string {
  if (key === "colaborador") return linha.colaboradorNome;
  if (key === "data") return formatarDataPdf(linha.data);
  if (key === "comissaoCents" || key === "dsrCents" || key === "premioCents" || key === "totalCents") {
    return formatarMoedaPdf(linha[key] as number);
  }
  const valor = linha[key as keyof LinhaEspelho];
  return valor === null || valor === undefined ? "--" : String(valor);
}

interface EspelhoPdfProps {
  preview: PreviewResult;
  tipo: string;
  periodoInicio: Date;
  periodoFim: Date;
  colaboradorNome?: string;
  codigoVerificacao: string;
  hash: string;
}

function EspelhoPdfDocument({ preview, tipo, periodoInicio, periodoFim, colaboradorNome, codigoVerificacao, hash }: EspelhoPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.titulo}>Espelho de Comissões e Prêmios</Text>
          <Text style={styles.subtitulo}>Gestão de Comissões e Prêmios — PainelAlpha</Text>
          <View style={styles.metaLinha}>
            <Text>Documento: {codigoVerificacao}</Text>
            <Text>Emitido em: {formatarDataPdf(new Date())}</Text>
          </View>
          <View style={styles.metaLinha}>
            <Text>Tipo: {tipo}</Text>
            <Text>Colaborador: {colaboradorNome ?? "Todos"}</Text>
          </View>
          <View style={styles.metaLinha}>
            <Text>Período: {formatarDataPdf(periodoInicio)} a {formatarDataPdf(periodoFim)}</Text>
          </View>
        </View>

        <View style={styles.tableHeader} fixed>
          {COLUNAS.map((coluna) => (
            <Text key={coluna.key} style={[styles.tableHeaderCell, { width: coluna.width }]}>
              {coluna.label}
            </Text>
          ))}
        </View>

        {preview.linhas.map((linha, index) => (
          <View
            key={linha.entryId + linha.componenteId}
            style={[styles.tableRow, index % 2 === 0 ? styles.tableRowZebra : {}]}
            wrap={false}
          >
            {COLUNAS.map((coluna) => (
              <Text key={coluna.key} style={[styles.cell, { width: coluna.width }]}>
                {valorDaLinha(linha, coluna.key)}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer} break={false}>
          <View style={styles.footerLinha}>
            <Text>Subtotal Comissão</Text>
            <Text>{formatarMoedaPdf(preview.totais.comissaoCents)}</Text>
          </View>
          <View style={styles.footerLinha}>
            <Text>Subtotal DSR</Text>
            <Text>{formatarMoedaPdf(preview.totais.dsrCents)}</Text>
          </View>
          <View style={styles.footerLinha}>
            <Text>Subtotal Prêmio</Text>
            <Text>{formatarMoedaPdf(preview.totais.premioCents)}</Text>
          </View>
          <View style={styles.footerLinha}>
            <Text>Subtotal Ajustes</Text>
            <Text>{formatarMoedaPdf(preview.totais.ajusteCents)}</Text>
          </View>
          <View style={[styles.footerLinha, { marginTop: 6 }]}>
            <Text style={styles.footerTotal}>Total Geral</Text>
            <Text style={styles.footerTotal}>{formatarMoedaPdf(preview.totais.totalGeralCents)}</Text>
          </View>
          <View style={[styles.footerLinha, { marginTop: 8 }]}>
            <Text>Código de verificação: {codigoVerificacao}</Text>
          </View>
          <View style={styles.footerLinha}>
            <Text>Hash: {hash}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function gerarPdfEspelho(params: EspelhoPdfProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<EspelhoPdfDocument {...params} />);
  return Buffer.from(buffer);
}
