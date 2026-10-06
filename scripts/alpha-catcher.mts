// Inspeção: node --conditions=react-server --import tsx scripts/alpha-catcher.mts arquivo.json
// Gravação explícita: acrescente --processar. Não executar contra produção como teste.
import { readFile } from 'node:fs/promises';
import { importarEmpresas, MAX_ARQUIVO_BYTES } from '../src/lib/alpha-catcher/core';

const [arquivo, modo] = process.argv.slice(2);
if (!arquivo || (modo && modo !== '--processar')) throw new Error('Use arquivo.json [--processar]');
const texto = await readFile(arquivo);
if (texto.byteLength > MAX_ARQUIVO_BYTES) throw new Error('Arquivo acima de 5 MB.');
const entrada = importarEmpresas(JSON.parse(texto.toString('utf8')));
console.log(JSON.stringify({ empresas: entrada.empresas.length, invalidos: entrada.invalidos, duplicados: entrada.duplicados }));
if (modo === '--processar') {
  const { processarEmpresa, EsperaCatcher } = await import('../src/lib/alpha-catcher/service');
  for (const empresa of entrada.empresas) {
    for (;;) {
      try {
        const resultado = await processarEmpresa(empresa);
        console.log(JSON.stringify(resultado));
        if (resultado.codigo === 'BLOCKED_BY_CAPTCHA') process.exit(1);
        break;
      } catch (error) {
        if (!(error instanceof EsperaCatcher)) throw error;
        await new Promise(resolve => setTimeout(resolve, error.segundos * 1000));
      }
    }
  }
}
