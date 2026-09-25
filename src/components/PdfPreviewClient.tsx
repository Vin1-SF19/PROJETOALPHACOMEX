"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { FichaAlphaPDF } from "./GerarFicha";

export default function PdfPreviewClient({ dados }: { dados: Parameters<typeof FichaAlphaPDF>[0]["dados"] }) {
  return (
    <PDFViewer style={{ width: "100%", height: "100vh" }}>
      <FichaAlphaPDF dados={dados} userLogado="VINICIUS" />
    </PDFViewer>
  );
}
