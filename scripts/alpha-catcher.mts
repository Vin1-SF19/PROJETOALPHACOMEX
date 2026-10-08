// Inspeção: node --conditions=react-server --import tsx scripts/alpha-catcher.mts arquivo.json
// Gravação explícita: acrescente --processar. Não executar contra produção como teste.
import { readFile } from 'node:fs/promises';
import { importarEmpresas, normalizarDiasReceita } from '../src/lib/alpha-catcher/core';

const [arquivo, ...opcoes] = process.argv.slice(2);
let processar = false;
let days = 30;
if (!arquivo) throw new Error('Use arquivo.json [--processar] [--days N]');
for (let i = 0; i < opcoes.length; i++) {
  if (opcoes[i] === '--processar') processar = true;
  else if (opcoes[i] === '--days' && opcoes[i + 1]?.trim()) {
    const valor = normalizarDiasReceita(Number(opcoes[++i]));
    if (valor === null) throw new Error('Dias deve ser inteiro maior ou igual a zero.');
    days = valor;
  } else throw new Error('Use arquivo.json [--processar] [--days N]');
}
const texto = await readFile(arquivo);
const entrada = importarEmpresas(JSON.parse(texto.toString('utf8')));
console.log(JSON.stringify({ empresas: entrada.empresas.length, invalidos: entrada.invalidos, duplicados: entrada.duplicados }));
if (processar) {
  const { processarEmpresa, EsperaCatcher } = await import('../src/lib/alpha-catcher/service');
  for (const empresa of entrada.empresas) {
    for (;;) {
      try {
        const resultado = await processarEmpresa(empresa, undefined, { days });
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
