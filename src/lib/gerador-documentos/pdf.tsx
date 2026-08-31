import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Gera o PDF final de um documento (contrato/proposta/etc) — mesmo conteúdo das
 * cláusulas já renderizadas (variáveis já substituídas), formatação simples e
 * profissional. Quando `partes` é fornecido, renderiza um bloco de qualificação
 * das partes (contratante + contratada) antes das cláusulas.
 * Via `@react-pdf/renderer`, mesma lib já usada em `src/lib/commissions/export/pdf-generator.tsx`.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.5 },
  titulo: { fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  dataContrato: { fontSize: 9, color: "#475569", marginBottom: 20 },
  partes: { marginBottom: 20, borderBottom: "1 solid #E2E8F0", paddingBottom: 16 },
  parteLabel: { fontSize: 9, fontWeight: "bold", color: "#334155", marginBottom: 4, textTransform: "uppercase" as const },
  parteLinha: { fontSize: 9, marginBottom: 2, color: "#1E293B" },
  clasula: { marginBottom: 16 },
  clasulaTitulo: { fontSize: 11, fontWeight: "bold", marginBottom: 4 },
  clasulaConteudo: { fontSize: 10, textAlign: "justify" },
  rodape: { position: "absolute", bottom: 24, left: 40, fontSize: 7, color: "#64748B" },
});

function formatarDataPdf(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(data);
}

function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatarEndereco(p: { logradouro?: string | null; numero?: string | null; bairro?: string | null; municipio?: string | null; uf?: string | null; cep?: string | null }): string {
  const partes = [p.logradouro, p.numero, p.bairro, p.municipio, p.uf].filter(Boolean);
  if (partes.length === 0) return "";
  let end = partes.join(", ");
  if (p.cep) end += ` - CEP ${p.cep}`;
  return end;
}

interface ClasulaDocumentoPdf {
  titulo: string;
  conteudo: string;
}

interface ParteContratante {
  razaoSocial: string;
  cnpj?: string | null;
  endereco?: string;
}

interface ParteContratada {
  razaoSocial: string;
  cnpj?: string | null;
  endereco?: string;
  naturezaJuridica?: string | null;
  representanteLegal?: string;
}

interface DocumentoPdfProps {
  titulo: string;
  clausulas: ClasulaDocumentoPdf[];
  /** Bloco de qualificação das partes (opcional — quando ausente, PDF só tem título + cláusulas). */
  partes?: {
    contratante?: ParteContratante;
    contratada?: ParteContratada;
  };
  /** Número de contrato (exibido no cabeçalho). */
  numeroContrato?: string;
}

function DocumentoPdfDocument({ titulo, clausulas, partes, numeroContrato }: DocumentoPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>{titulo}</Text>

        {numeroContrato && (
          <Text style={styles.dataContrato}>
            Contrato nº {numeroContrato} — {formatarDataPdf(new Date())}
          </Text>
        )}

        {partes && (partes.contratante || partes.contratada) && (
          <View style={styles.partes}>
            {partes.contratante && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.parteLabel}>Contratante</Text>
                <Text style={styles.parteLinha}>{partes.contratante.razaoSocial}</Text>
                {partes.contratante.cnpj && <Text style={styles.parteLinha}>CNPJ: {formatarCnpj(partes.contratante.cnpj)}</Text>}
                {partes.contratante.endereco && <Text style={styles.parteLinha}>{partes.contratante.endereco}</Text>}
              </View>
            )}
            {partes.contratada && (
              <View>
                <Text style={styles.parteLabel}>Contratada</Text>
                <Text style={styles.parteLinha}>{partes.contratada.razaoSocial}</Text>
                {partes.contratada.cnpj && <Text style={styles.parteLinha}>CNPJ: {formatarCnpj(partes.contratada.cnpj)}</Text>}
                {partes.contratada.endereco && <Text style={styles.parteLinha}>{partes.contratada.endereco}</Text>}
                {partes.contratada.naturezaJuridica && <Text style={styles.parteLinha}>Natureza Jurídica: {partes.contratada.naturezaJuridica}</Text>}
                {partes.contratada.representanteLegal && <Text style={styles.parteLinha}>Representante Legal: {partes.contratada.representanteLegal}</Text>}
              </View>
            )}
          </View>
        )}

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
