import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Gera o PDF final de um documento (contrato/proposta/etc) — mesmo conteúdo das
 * cláusulas já renderizadas (variáveis já substituídas), formatação simples e
 * profissional. NÃO reproduz o layout visual do documento original enviado no
 * upload do template (confirmado com o usuário) — via `@react-pdf/renderer`,
 * mesma lib já usada em `src/lib/commissions/export/pdf-generator.tsx`.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.5 },
  titulo: { fontSize: 16, fontWeight: "bold", marginBottom: 24 },
  clasula: { marginBottom: 16 },
  clasulaTitulo: { fontSize: 11, fontWeight: "bold", marginBottom: 4 },
  clasulaConteudo: { fontSize: 10, textAlign: "justify" },
  rodape: { position: "absolute", bottom: 24, left: 40, fontSize: 7, color: "#64748B" },
});

function formatarDataPdf(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(data);
}

interface ClasulaDocumentoPdf {
  titulo: string;
  conteudo: string;
}

interface DocumentoPdfProps {
  titulo: string;
  clausulas: ClasulaDocumentoPdf[];
}

function DocumentoPdfDocument({ titulo, clausulas }: DocumentoPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>{titulo}</Text>

        {clausulas.map((clasula, index) => (
          <View key={index} style={styles.clasula} wrap>
            <Text style={styles.clasulaTitulo}>{clasula.titulo}</Text>
            <Text style={styles.clasulaConteudo}>{clasula.conteudo}</Text>
          </View>
        ))}

        <Text style={styles.rodape}>Documento gerado em {formatarDataPdf(new Date())}</Text>
      </Page>
    </Document>
  );
}

export async function gerarPdfDocumento(params: DocumentoPdfProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<DocumentoPdfDocument {...params} />);
  return Buffer.from(buffer);
}
