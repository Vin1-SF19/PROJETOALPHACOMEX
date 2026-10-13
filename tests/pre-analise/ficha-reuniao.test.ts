import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { FichaAlphaPDF } from '@/components/GerarFicha';
import path from 'node:path';

async function gerar(finalidade?: 'pre-analise') {
  const buffer = await renderToBuffer(FichaAlphaPDF({
    dados: { rfb: { razaoSocial: 'Empresa Teste', dataConstituicao: '01/01/2020' }, extra: { observacoes: 'Observação preservada' } },
    userLogado: 'Closer', logoPath: path.resolve('public/LogoTipo02.png'), finalidade,
  }));
  const documento = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const paginas = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push({ tamanho: pagina.view, texto: conteudo.items.map(item => 'str' in item ? item.str : '').join(' ').replace(/\s+/g, ' ') });
  }
  await documento.destroy();
  return paginas;
}

describe('Ficha impressa do Pré Análise', () => {
  it('imprime as duas perguntas e confirmações juntas em uma página A4', async () => {
    const paginas = await gerar('pre-analise');
    expect(paginas).toHaveLength(1);
    expect(paginas[0].tamanho[2]).toBeCloseTo(595.28, 1);
    expect(paginas[0].tamanho[3]).toBeCloseTo(841.89, 1);
    const texto = paginas[0].texto;
    expect(texto).toContain('Com a revisão do RADAR, quanto a empresa estima que poderia vender a mais, nos próximos seis meses?');
    expect(texto).toContain('A cada R$ 100,00 vendidos, qual o valor líquido costuma ficar para a empresa, tirando os custos?');
    expect(texto.match(/A CONFIRMAR \( \)/g)).toHaveLength(2);
    expect(texto).not.toContain('OBSERVAÇÕES');
    expect(texto).not.toContain('Observação preservada');
  });
  it('mantém observações no modelo padrão usado por CRM e Bibble', async () => {
    const paginas = await gerar();
    expect(paginas).toHaveLength(1);
    expect(paginas[0].texto).toContain('OBSERVAÇÕES');
    expect(paginas[0].texto.toUpperCase()).toContain('OBSERVAÇÃO PRESERVADA');
    expect(paginas[0].texto).not.toContain('A CONFIRMAR');
  });
});
