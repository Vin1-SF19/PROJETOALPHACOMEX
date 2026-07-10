'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FichaAlphaPDF } from '@/components/GerarFicha';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

export default function PdfPreviewPage() {
  const dadosMock = {
    rfb: {
      dados: {
        razaoSocial: 'EMPRESA TESTE LTDA',
        cnpj: '00.000.000/0001-00',
        nome_socio: 'JOÃO TESTE',
        telefone: '(47) 99999-9999',
        uf: 'SC'
      }
    },
    radar: {
      dados: {
        submodalidade: 'Ilimitada'
      }
    },
    empresaqui: {
      dados: {
        regimeEA: 'LUCRO REAL'
      }
    }
  };

  return (
    <PDFViewer style={{ width: '100%', height: '100vh' }}>
      <FichaAlphaPDF dados={dadosMock} userLogado="VINICIUS" />
    </PDFViewer>
  );
}