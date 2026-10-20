import { describe, expect, it } from 'vitest';
import {
  campoRd, mapearCampoRd, normalizarDataRd, normalizarEmailRd,
  normalizarMoedaRd, normalizarTelefoneRd, normalizarTexto, normalizarUfRd,
} from '../../scripts/lib/rd-field-mapping.mjs';

const deal = (label: string, value: unknown, id?: string) => ({ deal_custom_fields: [{ custom_field_id: id, custom_field: { label }, value }] });
const field = (nome: string, tipo = 'selecao', extra = {}) => ({ nome, tipo, ...extra });
const options = (...rotulos: string[]) => rotulos.map((rotulo, i) => ({ chave: `key-${i}`, rotulo, ativo: true }));

describe('normalização RD com dados sintéticos', () => {
  it('normaliza acentos e espaços sem aceitar labels aproximados', () => {
    expect(normalizarTexto('  SITUAÇÃO   da Empresa ')).toBe('situacao da empresa');
    expect(campoRd(deal('Regime Tributário atual ', 'Lucro Real'), 'regime tributario atual')).toBe('Lucro Real');
    expect(campoRd(deal('Regime Tributário atual', 'Lucro Real'), 'Regime Tributário')).toBeNull();
    expect(campoRd({ deal_custom_fields: [...deal('Estado', 'SP').deal_custom_fields, ...deal('Estado', 'RJ').deal_custom_fields] }, 'Estado')).toBeNull();
  });
  it('normaliza o país sem inventar dígitos de celular legado', () => {
    expect(normalizarTelefoneRd('+55 (11) 98765-4321')).toBe('11987654321');
    expect(normalizarTelefoneRd('0055 11 3456-7890')).toBe('1134567890');
    expect(normalizarTelefoneRd('(11) 8765-4321')).toBe('1187654321');
    expect(normalizarTelefoneRd('55 55 98765-4321')).toBe('55987654321');
    for (const value of ['12345678', '11000000000', '11999999999', '2012345678', '11345678901', '+1 202 555 0123', '11 3456-7890 ramal 1', 'a definir']) expect(normalizarTelefoneRd(value)).toBeNull();
  });
  it('valida email e UF pela lista de estados, sem adivinhar municípios', () => {
    expect(normalizarEmailRd(' Contato@EXEMPLO.TEST ')).toBe('contato@exemplo.test');
    for (const email of ['nome', 'a@@example.test', 'a@b', 'a @b.test', 'a@b..test']) expect(normalizarEmailRd(email)).toBeNull();
    expect(normalizarUfRd('São Paulo')).toBe('SP');
    expect(normalizarUfRd('Tocantíns')).toBe('TO');
    expect(normalizarUfRd(' rj ')).toBe('RJ');
    expect(normalizarUfRd('São Paulo/SP')).toBeNull();
    expect(normalizarUfRd('XX')).toBeNull();
  });
  it('aceita datas reais completas sem inferir ano ou normalizar dias impossíveis', () => {
    expect(normalizarDataRd('29/02/2024')).toBe('2024-02-29');
    expect(normalizarDataRd('2026-10-16')).toBe('2026-10-16');
    for (const date of ['29/02/2025', '31/04/2026', '2026-00-01', 'Fevereiro', '10/2026', '2026-10', '16/10', '2026-10-16T00:00:00Z']) expect(normalizarDataRd(date)).toBeNull();
  });
  it('distingue decimal BR/internacional de texto e separador ambíguo', () => {
    for (const value of ['R$ 1.234,56', '1234,56', '1234.56', '1,234.56']) expect(normalizarMoedaRd(value)).toBe('1234.56');
    expect(normalizarMoedaRd('1.234.567')).toBe('1234567');
    expect(normalizarMoedaRd(0)).toBe('0');
    expect(normalizarMoedaRd('1000,00')).toBe('1000');
    for (const value of ['1.000', '1,000', '-10', -1, NaN, Infinity, 'R$ 1000 de entrada', '10mil', '1.23,45', '', '1e3']) expect(normalizarMoedaRd(value)).toBeNull();
  });
});

describe('mapeamento semântico RD para os formulários Alpha', () => {
  it('retorna a chave vigente do funil, preservando identidade das opções', () => {
    const source = deal('Radar pretendido ', 'Modalidade ilimitada');
    expect(mapearCampoRd(source, field('Radar pretendido'), options('Revisão de Radar Ilimitado'))).toEqual({ value: 'key-0', reason: null, sourceLabel: 'Radar pretendido' });
    expect(mapearCampoRd(source, field('Radar pretendido'), [{ chave: 'opcao_3', rotulo: 'Revisão de Radar Ilimitado', ativo: true }]).value).toBe('opcao_3');
    expect(mapearCampoRd(source, field('Radar pretendido'), [{ chave: 'desativada', rotulo: 'Revisão de Radar Ilimitado', ativo: false }]).value).toBeNull();
    expect(mapearCampoRd(source, field('Radar pretendido'), [{ chave: '', rotulo: 'Revisão de Radar Ilimitado', ativo: true }]).value).toBeNull();
    expect(mapearCampoRd(source, field('Radar pretendido'), options('Radar ilimitado similar')).value).toBeNull();
    expect(mapearCampoRd(source, field('Radar pretendido'), options('Revisão de Radar Ilimitado', 'Revisão de Radar Ilimitado')).value).toBeNull();
  });
  it('aceita chave exata e rótulo exato, sem aceitar opção de outro campo', () => {
    const source = deal('Histórico de tentativas anteriores de revisão', 'SIM');
    expect(mapearCampoRd(source, field('Histórico de tentativas anteriores'), options('Sim', 'Não')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Histórico de tentativas anteriores de revisão', 'key-1'), field('Histórico de tentativas anteriores'), options('Sim', 'Não')).value).toBe('key-1');
    expect(mapearCampoRd(source, field('Histórico de tentativas anteriores'), options('Suficiente')).reason).toBe('opcao_sem_equivalencia_ativa');
  });
  it('não confunde limites de faturamento ou impostos com suficiência', () => {
    const dest = field('Faturamento nos últimos 5 anos');
    const opts = options('Menos de 5M', 'De 5 a 16M', 'Acima de 16M');
    expect(mapearCampoRd(deal(dest.nome, '-5M'), dest, opts).value).toBe('key-0');
    expect(mapearCampoRd(deal(dest.nome, 'Menos de 5M'), dest, opts).value).toBe('key-0');
    for (const value of ['De 5 à 15M', 'Acima de 15M']) expect(mapearCampoRd(deal(dest.nome, value), dest, opts).reason).toBe('faixas_faturamento_incompativeis');
    expect(mapearCampoRd(deal('Impostos pagos no último semestre', 'Acima de 74 mil'), field('Tributos pagos no último semestre'), options('Suficiente para Radar Ilimitado')).reason).toBe('faixa_impostos_nao_prova_suficiencia');
  });
  it('mapeia somente as condições de pagamento comprovadamente equivalentes', () => {
    const dest = field('Forma de pagamento');
    const opts = options('50% Entrada / 50% Êxito (Pix)', 'Parcelamento Cartão de Crédito - até 12x com juros', 'Integral na contratação - 10% OFF (Pix)');
    expect(mapearCampoRd(deal(dest.nome, '50% na contratação e 50% no êxito - PIX'), dest, opts).value).toBe('key-0');
    expect(mapearCampoRd(deal(dest.nome, 'Cartão de crédito até 12x com juros'), dest, opts).value).toBe('key-1');
    expect(mapearCampoRd(deal(dest.nome, 'à vista (10% de desconto)'), dest, opts).value).toBe('key-2');
    for (const value of ['à vista (conforme o contrato)', 'à vista (15% de desconto)', '50% na contratação e 50% no êxito - Cartão de crédito', 'à definir']) expect(mapearCampoRd(deal(dest.nome, value), dest, opts).value).toBeNull();
  });
  it('recupera atributos canônicos e status sem interpretar status como dinheiro', () => {
    expect(mapearCampoRd(deal('Estado', 'São Paulo'), field('UF', 'texto', { fonteAtributo: 'uf' })).value).toBe('SP');
    expect(mapearCampoRd(deal('Regime Tributário atual', 'Lucro Real '), field('Regime tributário do cliente'), options('Simples Nacional', 'Lucro Real')).value).toBe('key-1');
    expect(mapearCampoRd(deal('Data de abertura da empresa', '16/10/2000'), field('Abertura', 'data', { fonteAtributo: 'dataConstituicao' })).value).toBe('2000-10-16');
    expect(mapearCampoRd(deal('Capital Social', 'Integralizado'), field('Situação do capital social', 'texto_longo')).value).toBe('Integralizado');
    expect(mapearCampoRd(deal('Capital Social', 'Integralizado'), field('Capital social', 'moeda', { fonteAtributo: 'capitalSocial' })).value).toBeNull();
    expect(mapearCampoRd(deal('Capital Social', '1000'), field('Capital social', 'moeda')).reason).toBe('status_capital_social_nao_e_valor');
    expect(mapearCampoRd(deal('Sede da empresa (Endereço CNPJ)', 'Imóvel alugado'), field('Status da sede', 'texto')).value).toBe('Imóvel alugado');
  });
  it('mapeia armazenamento, faturas, atuação, complexidade e embasamento explícitos', () => {
    expect(mapearCampoRd(deal('Armazém', 'Na sede da empresa - Alugado'), field('Armazenamento'), options('Sede da empresa — imóvel alugado')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Armazém', 'Sem local definido'), field('Armazenamento'), options('Sem local definido')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Faturas', 'Internet e energia ok'), field('Faturas sob titularidade da empresa'), options('Internet e energia')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Faturas', 'Despesas inclusas no coworking'), field('Faturas sob titularidade da empresa'), options('Despesas inclusas no coworking')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Atuação da empresa', 'Varejo/ecommerce'), field('Atuação da empresa'), options('Varejo/e-commerce')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Nível de complexidade para a revisão', 'Nível 2 - Apenas ajustes na capacidade operacional'), field('Nível de complexidade da revisão'), options('Nível 2 — Ajustes na capacidade operacional')).value).toBe('key-0');
    expect(mapearCampoRd(deal('Embasamento do processo', 'Início ou retomada - Impostos semestrais'), field('Embasamento do processo'), options('Início ou retomada — Tributos semestrais')).value).toBe('key-0');
  });
  it('usa ID do valor acordado e bloqueia sua conversão para valor bruto', () => {
    const source = deal('label alterado', 'R$ 1.234,56', '667ee3fc94c71a001613e5df');
    expect(mapearCampoRd(source, field('Valor acordado no contrato', 'moeda')).value).toBe('1234.56');
    expect(mapearCampoRd(source, field('Valor bruto do contrato', 'moeda')).reason).toBe('valor_liquido_nao_equivale_bruto');
  });
  it('mantém indefinições como ausência sem inferir vínculo ou canal comercial', () => {
    expect(mapearCampoRd(deal('Capital Social', 'à verificar'), field('Situação do capital social', 'texto_longo')).value).toBeNull();
    expect(mapearCampoRd({ deal_source: { name: 'Campanha Exemplo' } }, field('Canal de origem', 'texto')).value).toBe('Campanha Exemplo');
    expect(mapearCampoRd({ deal_source: { name: 'Direto' } }, field('Origem do cliente'), options('Direto')).value).toBeNull();
    expect(mapearCampoRd(deal('Vendedor', 'Nome Exemplo'), field('Vendedor responsável', 'usuario')).value).toBeNull();
    expect(mapearCampoRd(deal('Parceiro indicante', 'Nome Exemplo'), field('Parceiro responsável', 'texto', { fonteEntidade: 'PARCEIRO' })).value).toBeNull();
    expect(mapearCampoRd(deal('Mês para protocolar', 'Outubro'), field('Mês para protocolar', 'data')).value).toBeNull();
    expect(mapearCampoRd({}, field('Resumo da reunião', 'texto_longo')).reason).toBe('sem_dado_rd_inequivoco');
  });
});
