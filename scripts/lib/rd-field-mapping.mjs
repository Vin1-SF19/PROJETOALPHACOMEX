/** Conversões puras: não acessam banco nem escolhem entre identidades concorrentes. */
export function normalizarTexto(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const placeholders = new Set(['', '-', '--', 'a definir', 'a verificar', 'nao informado', 'nao informada', 'nao definido', 'desconhecido', 'unknown', 'undefined', 'null', 'n/a', 'sem informacao']);
const ausente = value => value === null || value === undefined || placeholders.has(normalizarTexto(value));
export const dadoRdAusente = ausente;
const scalar = value => Array.isArray(value) ? (value.length === 1 ? scalar(value[0]) : null) : (typeof value === 'string' || typeof value === 'number' ? value : null);

function lerCampo(deal, label, id = null) {
  const campos = (deal?.deal_custom_fields ?? []).filter(c => id
    ? [c.custom_field_id, c.custom_field?.id, c.custom_field?._id].includes(id)
    : normalizarTexto(c.custom_field?.label ?? c.label) === normalizarTexto(label));
  const values = campos.map(c => scalar(c.value)).filter(v => !ausente(v));
  const unique = new Map(values.map(v => [String(v).trim(), v]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

/** Somente label exato normalizado; duplicatas contraditórias não elegem vencedor. */
export function campoRd(deal, label) { return lerCampo(deal, label); }

const ddds = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export function normalizarTelefoneRd(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^(?:\+|00)?[\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0055')) digits = digits.slice(4);
  else if (digits.startsWith('55') && [12, 13].includes(digits.length)) digits = digits.slice(2);
  else if (raw.startsWith('+') || raw.startsWith('00')) return null;
  if (![10, 11].includes(digits.length) || !ddds.has(digits.slice(0, 2))) return null;
  const local = digits.slice(2);
  if (/^(\d)\1+$/.test(local) || !/^[2-9]/.test(local) || (local.length === 9 && !local.startsWith('9'))) return null;
  return digits;
}

export function normalizarEmailRd(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) ? email : null;
}

const estados = Object.fromEntries([
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
].flatMap(([uf, nome]) => [[normalizarTexto(uf), uf], [normalizarTexto(nome), uf]]));
export function normalizarUfRd(value) { return estados[normalizarTexto(value)] ?? null; }

export function normalizarDataRd(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!iso && !br) return null;
  const [year, month, day] = (iso ? iso.slice(1) : [br[3], br[2], br[1]]).map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

export function normalizarMoedaRd(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100)) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/^R\$\s*/i, '');
  let canonical;
  if (/^\d+$/.test(raw)) canonical = raw;
  else if (/^\d+[.,]\d{1,2}$/.test(raw)) canonical = raw.replace(',', '.');
  else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) canonical = raw.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) canonical = raw.replace(/,/g, '');
  else if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(raw)) canonical = raw.replace(/\./g, '');
  else return null; // 1.000 / 1,000 têm interpretação decimal/milhar ambígua.
  const number = Number(canonical);
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number * 100)) ? String(number) : null;
}

const sourceLabels = {
  'radar pretendido': 'Radar pretendido', 'radar atual': 'Radar atual da empresa',
  'regime tributario do cliente': 'Regime Tributário atual', 'regime tributario': 'Regime Tributário atual',
  'estado': 'Estado', 'uf': 'Estado', 'data de abertura da empresa': 'Data de abertura da empresa',
  'situacao do capital social': 'Capital Social', 'status da sede': 'Sede da empresa (Endereço CNPJ)',
  'armazenamento': 'Armazém', 'faturas sob titularidade da empresa': 'Faturas', 'faturas sob titularidade': 'Faturas',
  'atuacao': 'Atuação da empresa', 'tributos pagos no ultimo semestre': 'Impostos pagos no último semestre',
  'valor acordado': 'Valor acordado no contrato (OBS: CASO TENHA SIDO CONCEDIDO DESCONTO, CONSIDERAR O VALOR COM O DESCONTO APLICADO)',
  'valor acordado no contrato': 'Valor acordado no contrato (OBS: CASO TENHA SIDO CONCEDIDO DESCONTO, CONSIDERAR O VALOR COM O DESCONTO APLICADO)',
  'nivel de complexidade da revisao': 'Nível de complexidade para a revisão',
  'historico de tentativas anteriores': 'Histórico de tentativas anteriores de revisão',
};

/** Pares observados no catálogo RD/Alpha, nunca correspondência aproximada. */
const equivalencias = {
  'radar pretendido': [
    ['Habilitação', 'Habilitação de Radar 50k'],
    ['Modalidade de 150 mil dólares semestrais', 'Revisão de Radar Limitado a USD150k'],
    ['Modalidade ilimitada', 'Revisão de Radar Ilimitado'],
  ],
  'faturamento nos ultimos 5 anos': [['-5M', 'Menos de 5M']],
  'armazem': [
    ['Na sede da empresa - Alugado', 'Sede da empresa — imóvel alugado'],
    ['Na sede da empresa - próprio', 'Sede da empresa — imóvel próprio'],
    ['Local separado - Galpão alugado', 'Local separado — galpão alugado'],
    ['Local separado - Galpão próprio', 'Local separado — galpão próprio'],
    ['Local separado - Operador logístico', 'Operador logístico'],
  ],
  'faturas': [['Internet ok', 'Internet'], ['Energia ok', 'Energia'], ['Internet e energia ok', 'Internet e energia']],
  'atuacao da empresa': [['Varejo/ecommerce', 'Varejo/e-commerce']],
  'forma de pagamento': [
    ['50% na contratação e 50% no êxito - PIX', '50% Entrada / 50% Êxito (Pix)'],
    ['Cartão de crédito até 12x com juros', 'Parcelamento Cartão de Crédito - até 12x com juros'],
    ['à vista (10% de desconto)', 'Integral na contratação - 10% OFF (Pix)'],
  ],
  'nivel de complexidade para a revisao': [
    ['Nível 1 - Sem ajustes na documentação', 'Nível 1 — Sem ajustes na documentação'],
    ['Nível 2 - Apenas ajustes na capacidade operacional', 'Nível 2 — Ajustes na capacidade operacional'],
    ['Nível 3 - Estratégia de mudança de regime tributário para usar início ou Retomada como embasamento', 'Nível 3 — Mudança de regime tributário usando início/retomada'],
    ['Nível 4 - Ajustes complexos', 'Nível 4 — Ajustes complexos'],
  ],
  'embasamento do processo': [['Início ou retomada - Impostos semestrais', 'Início ou retomada — Tributos semestrais']],
};

function opcaoAtiva(value, sourceLabel, options) {
  const norm = normalizarTexto(value);
  const target = equivalencias[normalizarTexto(sourceLabel)]?.find(([from]) => normalizarTexto(from) === norm)?.[1];
  const matches = options.filter(option => option.ativo !== false && option.ativo !== 0 && typeof option.chave === 'string' && option.chave.trim() && (
    option.chave === String(value).trim() || normalizarTexto(option.rotulo) === norm || (target && normalizarTexto(option.rotulo) === normalizarTexto(target))
  ));
  const keys = [...new Set(matches.map(option => option.chave))];
  return keys.length === 1 ? keys[0] : null;
}

/** Retorna somente um valor representável no destino; o chamador decide se ele está vazio. */
export function mapearCampoRd(deal, field, options = []) {
  const nome = normalizarTexto(field?.nome);
  const atributo = field?.fonteAtributo;
  const fail = (reason, sourceLabel = null) => ({ value: null, reason, sourceLabel });
  if (field?.tipo === 'usuario' || field?.fonteEntidade === 'PARCEIRO' || ['responsavelId', 'responsavelNome', 'responsavelCpf', 'capitalSocial'].includes(atributo) || ['vendedor responsavel', 'parceiro responsavel'].includes(nome)) return fail('vinculo_ou_identidade_exige_evidencia');
  if (nome === 'origem do cliente') return fail('origem_comercial_nao_inferida');
  if (nome === 'valor bruto do contrato' || String(field?.chave ?? '').includes('valor.bruto')) return fail('valor_liquido_nao_equivale_bruto');
  if (['fonte', 'canal de origem'].includes(nome) && field.tipo === 'texto') {
    const source = scalar(deal?.deal_source?.name);
    return ausente(source) ? fail('sem_dado_rd', 'deal_source.name') : { value: String(source).trim(), reason: null, sourceLabel: 'deal_source.name' };
  }
  const sourceLabel = atributo === 'uf' ? 'Estado' : atributo === 'regimeTributario' ? 'Regime Tributário atual' : atributo === 'dataConstituicao' ? 'Data de abertura da empresa' : (sourceLabels[nome] ?? field?.nome);
  if (!sourceLabel) return fail('campo_sem_mapeamento');
  if (normalizarTexto(sourceLabel) === 'capital social' && field.tipo === 'moeda') return fail('status_capital_social_nao_e_valor', sourceLabel);
  const valorAcordado = ['valor acordado', 'valor acordado no contrato'].includes(nome);
  const raw = valorAcordado ? lerCampo(deal, sourceLabel, '667ee3fc94c71a001613e5df') ?? campoRd(deal, sourceLabel) : campoRd(deal, sourceLabel);
  if (ausente(raw)) return fail('sem_dado_rd_inequivoco', sourceLabel);
  if (normalizarTexto(sourceLabel) === 'impostos pagos no ultimo semestre') return fail('faixa_impostos_nao_prova_suficiencia', sourceLabel);
  if (normalizarTexto(sourceLabel) === 'faturamento nos ultimos 5 anos' && ['de 5 a 15m', 'acima de 15m'].includes(normalizarTexto(raw))) return fail('faixas_faturamento_incompativeis', sourceLabel);
  let value = String(raw).trim();
  if (atributo === 'uf' || ['estado', 'uf'].includes(nome)) value = normalizarUfRd(raw);
  else if (field.tipo === 'data' || atributo === 'dataConstituicao') value = normalizarDataRd(raw);
  else if (field.tipo === 'moeda') value = normalizarMoedaRd(raw);
  else if (field.tipo === 'email') value = normalizarEmailRd(raw);
  else if (field.tipo === 'telefone') value = normalizarTelefoneRd(raw);
  else if (field.tipo === 'selecao') value = opcaoAtiva(raw, sourceLabel, options);
  else if (!['texto', 'texto_longo'].includes(field.tipo)) return fail('tipo_sem_conversao_segura', sourceLabel);
  return value === null ? fail(field.tipo === 'selecao' ? 'opcao_sem_equivalencia_ativa' : 'valor_invalido_para_tipo', sourceLabel) : { value, reason: null, sourceLabel };
}
