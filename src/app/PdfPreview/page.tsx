'use client';

import dynamic from 'next/dynamic';

const PdfPreviewClient = dynamic(() => import('@/components/PdfPreviewClient'), { ssr: false });

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
    <PdfPreviewClient dados={dadosMock} />
  );
}