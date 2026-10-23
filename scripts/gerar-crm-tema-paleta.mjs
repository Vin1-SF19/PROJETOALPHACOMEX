// Gera src/components/crm-visual/crm-tema-paleta.css (tema claro do Alpha CRM).
// Uso: node scripts/gerar-crm-tema-paleta.mjs (rodar da raiz; refazer ao atualizar o Tailwind).
import fs from 'node:fs';
const theme = fs.readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const v = {};
for (const m of theme.matchAll(/--color-([a-z]+(?:-\d+)?):\s*([^;]+);/g)) v[m[1]] = m[2].trim();
const neutros = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const cromaticas = ['red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose'];
// Superfícies (700–950) param em 100–300, não no branco puro: o claro fica suave, sem ofuscar.
const inverso = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 500, 700: 300, 800: 300, 900: 200, 950: 100 };
const escurecer = { 50: 900, 100: 800, 200: 800, 300: 700, 400: 600 };
const claro = [], restaurar = [];
claro.push(`  --color-white: ${v['slate-900']};`, `  --color-black: ${v['white']};`);
restaurar.push(`  --color-white: ${v['white']};`, `  --color-black: ${v['black']};`);
for (const n of neutros) {
  claro.push(`  /* ${n} */`);
  for (const [de, para] of Object.entries(inverso)) {
    claro.push(`  --color-${n}-${de}: ${v[`${n}-${para}`]};`);
    restaurar.push(`  --color-${n}-${de}: ${v[`${n}-${de}`]};`);
  }
}
for (const c of cromaticas) {
  claro.push(`  --color-${c}-50: ${v[`${c}-900`]}; --color-${c}-100: ${v[`${c}-800`]}; --color-${c}-200: ${v[`${c}-800`]}; --color-${c}-300: ${v[`${c}-700`]}; --color-${c}-400: ${v[`${c}-600`]};`);
  restaurar.push(`  --color-${c}-50: ${v[`${c}-50`]}; --color-${c}-100: ${v[`${c}-100`]}; --color-${c}-200: ${v[`${c}-200`]}; --color-${c}-300: ${v[`${c}-300`]}; --color-${c}-400: ${v[`${c}-400`]};`);
}
const solidos = [];
for (const c of cromaticas) for (const s of [300, 400, 500, 600, 700]) solidos.push(`.bg-${c}-${s}`, `.bg-${c}-${s}\\/90`);
for (const c of cromaticas) for (const s of [400, 500, 600]) solidos.push(`.from-${c}-${s}`);
const linhas = (arr, porLinha) => arr.reduce((acc, s, i) => { if (i % porLinha === 0) acc.push([]); acc[acc.length - 1].push(s); return acc; }, []).map((l) => '    ' + l.join(', ')).join(',\n');
const out = `/* ─────────────── Alpha CRM — Tema claro: paleta remapeada ──────────
 * GERADO por scripts/gerar-crm-tema-paleta.mjs a partir de node_modules/tailwindcss/theme.css.
 * Não editar à mão: rode o script de novo.
 *
 * Como funciona: as utilidades do Tailwind v4 leem var(--color-*). No tema claro,
 * o CRM redefine essas variáveis no <html> (alcança modais/sheets em portal) e no
 * .crm-scope (já vem no HTML do servidor, sem piscar escuro antes da hidratação):
 * - branco ↔ slate-900 e a escala neutra é invertida (texto claro vira escuro, vidro
 *   branco translúcido vira véu escuro translúcido);
 * - tons cromáticos 50–400 (pensados para fundo escuro) escurecem para 600–900,
 *   garantindo contraste de status (âmbar, rosa, esmeralda…) sobre fundo claro.
 * Superfícies de cor sólida (botões bg-*-300…700, gradientes from-*) restauram a paleta
 * original no próprio subtree: o botão fica idêntico ao tema escuro. Para casos com cor
 * inline (accent do usuário), use a classe .crm-tema-fixo.
 */
:is(html, .crm-scope)[data-crm-tema="claro"] {
${claro.join('\n')}
}

:is(html, .crm-scope)[data-crm-tema="claro"] :is(
${linhas(['.crm-tema-fixo', ...solidos], 8)}
) {
${restaurar.join('\n')}
}
`;
fs.writeFileSync('src/components/crm-visual/crm-tema-paleta.css', out);
console.log(out.split('\n').length, 'linhas');
