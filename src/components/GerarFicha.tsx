import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: { width: 130, height: 'auto' },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
    flexDirection: 'column',
  },
  headerLine: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 2,
  },
  headerText: { fontSize: 9, fontWeight: 'bold' },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
    marginBottom: 5,
  },
  row: { flexDirection: 'row' },
  cell: {
    padding: 3,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
  },
  titleCell: {
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    padding: 3,
  },
  label: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  value: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  circle: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1, borderColor: '#000' },
  circleFilled: { width: 10, height: 10, borderRadius: 3.5, backgroundColor: '#000' },
  optionText: { fontSize: 8, fontWeight: 'bold' },
  finGrid: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  finBox: { flex: 1, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#000' },
  finHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#000'
  },
  finTitle: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  finContent: { fontSize: 8, padding: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#000' },
  finFooter: { flexDirection: 'row', borderRightWidth: 1, borderColor: '#000' },
  finFooterCell: { flex: 1, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#000', padding: 2, textAlign: 'center', fontSize: 7, fontWeight: 'bold' },
  obsSection: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    marginTop: 5,
    flexGrow: 1,
  },
  funilRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
    fontSize: 7,
    fontWeight: 'bold',
  }
});

export const FichaAlphaPDF = ({ dados, userLogado, logoPath }: { dados: any, userLogado: string, logoPath?: string }) => {
  const rfb = dados?.rfb?.dados || dados?.rfb || {};
  const radar = dados?.radar || {};
  const eq = dados?.empresaqui?.dados || dados?.empresaqui || {};

  const origemLead = dados.extra?.origemLead || "";
  const origemDetalhe = dados.extra?.origemLeadDetalhe || "";

  const radarExibicao = String(radar?.submodalidade || " ").toUpperCase();
  const situacaoRadar = String(radar?.situacao || " ").toUpperCase();
  const regime = String(eq?.regimeEA || " ").toUpperCase();
  const uf = String(rfb?.uf || " ").toUpperCase();


  const dataAbertura = rfb?.dataConstituicao || "";
  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const horaHoje = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });


  let maisDe5Anos = false;
  let menosDe5Anos = false;

  if (dataAbertura && dataAbertura.includes("/")) {
    const [dia, mes, ano] = dataAbertura.split("/").map(Number);
    const dataAberturaDoc = new Date(ano, mes - 1, dia);

    let idade = agora.getFullYear() - dataAberturaDoc.getFullYear();
    const m = agora.getMonth() - dataAberturaDoc.getMonth();

    if (m < 0 || (m === 0 && agora.getDate() < dataAberturaDoc.getDate())) {
      idade--;
    }

    maisDe5Anos = idade >= 5;
    menosDe5Anos = idade < 5;
  }


  return (
    <Document title={`Ficha Alpha - ${rfb?.razaoSocial || 'Reunião'}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoPath ?? "/LogoTipo02.png"} style={styles.logo} />
          <View style={[styles.headerInfo, { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 5, marginLeft: 10 }]}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text wrap={false} style={[styles.headerText, { marginBottom: 2 }]}>CLOSER: {userLogado} / FICHA DE REUNIÃO</Text>
              <Text wrap={false} style={[styles.headerText, { marginBottom: 2 }]}>ALIMENTADO NO CRM (RD): (   ) SIM (   ) NÃO</Text>
              <Text wrap={false} style={styles.headerText}>PROPOSTA ENVIADA: (   ) SIM (   ) NÃO</Text>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              <Text wrap={false} style={styles.headerText}>
                DATA: {dados.extra?.dataSituacao || "___/___/___"}
              </Text>
              <Text wrap={false} style={styles.headerText}>
                HORARIO: {dados.extra?.horaSituacao || "__:__"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { flex: 2.5 }]}><Text style={styles.label}>NOME DO RESPONSÁVEL DA EMPRESA</Text><Text style={styles.value}>{dados.extra?.nomeResponsavel || "_________________________________"}</Text></View>
            <View style={[styles.cell, { flex: 1.5 }]}><Text style={styles.label}>TELEFONE</Text><Text style={styles.value}>{dados.extra?.telefone || "(__) _____-____"}</Text>
            </View>
            <View style={[styles.cell, { flex: 2 }]}>
              <Text style={styles.label}>E-MAIL</Text>
              <Text style={styles.value}>
                {dados.extra?.email || "____________________________"}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.cell, { flex: 1 }]}>
              <Text style={styles.label}>ORIGEM DO LEAD</Text>
              {origemLead ? (
                <View style={styles.optionRow}>
                  <View style={styles.circleFilled} />
                  <Text style={styles.optionText}>
                    {origemLead === "instagram" && "INSTAGRAM"}
                    {origemLead === "google" && "GOOGLE"}
                    {origemLead === "callix" && "CALLIX"}
                    {origemLead === "parceiro" && (origemDetalhe ? `PARCEIRO: ${origemDetalhe}` : "PARCEIRO")}
                    {origemLead === "indicacao" && (origemDetalhe ? `INDICAÇÃO: ${origemDetalhe}` : "INDICAÇÃO")}
                    {origemLead === "outros" && (origemDetalhe ? `OUTROS: ${origemDetalhe}` : "OUTROS")}
                  </Text>
                </View>
              ) : (
                <View style={[styles.optionRow, { flexWrap: 'wrap', gap: 10, marginTop: 4 }]}>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>INSTAGRAM</Text></View>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>GOOGLE</Text></View>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>CALLIX</Text></View>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>PARCEIRO__________</Text></View>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>INDICAÇÃO__________</Text></View>
                  <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>OUTROS______________</Text></View>
                </View>
              )}
            </View>
          </View>
          <View style={styles.row}>
            {/*Razão Social e Fantasia empilhados */}
            <View style={[styles.cell, { flex: 3 }]}>
              <View>
                <Text style={styles.label}>Razão Social</Text>
                <Text style={styles.value}>{rfb.razaoSocial || "_________________________________"}</Text>
              </View>

              <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Fantasia</Text>
                <Text style={styles.value}>{rfb.nomeFantasia || "_________________________________"}</Text>
              </View>
            </View>

            <View style={[styles.cell, { flex: 1 }]}>
              <Text style={styles.label}>CNPJ</Text>
              <Text style={styles.value}>{rfb.cnpj || "___.___.___/____-__"}</Text>
            </View>

            <View style={[styles.cell, { flex: 0.5 }]}>
              <Text style={styles.label}>UF</Text>
              <Text style={styles.value}>{rfb.uf || "__"}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { flex: 1 }]}>
              <Text style={styles.label}>RADAR ATUAL</Text>
              <View style={styles.optionRow}>
                <Text style={styles.value}>{radarExibicao || "__"}</Text>
              </View>
            </View>

            <View style={[styles.cell, { flex: 0.5 }]}>
              <Text style={styles.label}>SITUAÇÃO</Text>
              <View style={styles.optionRow}>
                <Text style={styles.value}>{situacaoRadar}</Text>
              </View>
            </View>

            <View style={[styles.cell, { flex: 1 }]}>
              <Text style={styles.label}>RADAR PRETENDIDO</Text>
              <View style={styles.optionRow}>
                <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>Habilitação (50K)</Text></View>
                <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>150K</Text></View>
                <View style={styles.optionRow}><View style={styles.circle} /><Text style={styles.optionText}>ILIMITADO</Text></View>
              </View>
            </View>
          </View>

        </View>

        <View style={{ flexDirection: 'row', gap: 5 }}>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.cell, styles.titleCell, styles.label]}>CONSTITUIÇÃO</Text>
            <View style={styles.cell}>
              <View style={styles.optionRow}><View style={maisDe5Anos ? styles.circleFilled : styles.circle} /><Text style={styles.optionText}>+ MAIS DE 5 ANOS</Text></View>
              <View style={styles.optionRow}><View style={menosDe5Anos ? styles.circleFilled : styles.circle} /><Text style={styles.optionText}>- MENOS DE 5 ANOS</Text></View>
              <Text style={[styles.optionText, { marginTop: 4 }]}>Data de Constituição: {dataAbertura}</Text>
            </View>
          </View>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.cell, styles.titleCell, styles.label]}>REGIME TRIBUTÁRIO</Text>
            <View style={styles.cell}>

              <View style={styles.optionRow}>
                <View style={regime.includes("SIMPLES") ? styles.circleFilled : styles.circle} />
                <Text style={styles.optionText}>SIMPLES NACIONAL</Text>
              </View>

              <View style={styles.optionRow}>
                <View style={(regime.includes("REAL") || regime.includes("PRESUMIDO")) ? styles.circleFilled : styles.circle} />
                <Text style={styles.optionText}>REGIME NORMAL</Text>
              </View>

              <View style={[styles.optionRow, { marginTop: 4 }]}>
                <Text style={[styles.optionText, { color: '#666' }]}>Obs: </Text>
                {(regime.includes("REAL") || regime.includes("PRESUMIDO")) && (
                  <Text style={styles.optionText}>{eq.regimeEA}</Text>
                )}
              </View>

            </View>
          </View>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.cell, styles.titleCell, styles.label]}>MÊS DE PROTOCOLO:</Text>
            <View style={[styles.cell, { flex: 1, alignItems: 'center' }]}><Text style={{ marginTop: 10 }}>{dados.extra?.mesProtocolo || "_______________"}</Text></View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 5 }}>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.cell, styles.titleCell, styles.label]}>CAPACIDADE OPERACIONAL</Text>
            <View style={styles.cell}>
              <Text style={styles.optionText}>SEDE: (   ) ALUGADO (  ) PRÓPRIO</Text>
              <Text style={styles.optionText}>FATURAS: (   ) NET (   ) ENERGIA</Text>
              <Text style={styles.optionText}>ARMAZÉM: (   ) SEDE (   ) OUTRO</Text>
            </View>
          </View>
          <View style={[styles.table, { flex: 1 }]}>
            <Text style={[styles.cell, styles.titleCell, styles.label]}>CONSTITUIÇÃO REGULAR</Text>
            <View style={styles.cell}>
              <View style={styles.optionRow}>
                <Text style={styles.optionText}>
                  CAPITAL SOCIAL: {
                    rfb?.capitalSocial || rfb?.dados?.capital_social || rfb?.dados?.dados?.capitalSocial
                      ? Number(rfb?.capitalSocial || rfb?.dados?.capital_social).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })
                      : "R$ 0,00"
                  }
                </Text>
              </View>
              <Text style={styles.optionText}>(   ) INTEGRALIZADO (   ) NÃO INT.</Text>
              <Text style={styles.optionText}>(   ) + DE 5 ANOS</Text>
            </View>
          </View>
        </View>

        <Text style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 }}>CAPACIDADE FINANCEIRA (EMBASAMENTOS PARA REVISÃO DE RADAR)</Text>

        <View style={styles.finGrid}>
          <View style={styles.finBox}>
            <View style={styles.finHeader}><View style={styles.circle} /><Text style={styles.finTitle}>DISPONIBILIDADE FINANCEIRA</Text></View>
            <View style={styles.finContent}>
              <Text>• Lucro Real, Presumido ou Simples</Text>
              <Text>• Qualquer tempo de empresa</Text>
              <Text>• Saldo em liquidez imediata último dia mês:</Text>
              <Text>150k: R$ 266K (R$ 265.380) | Ilim: R$ 797K (R$ 796.140)</Text>
            </View>
            <View style={styles.finFooter}><Text style={styles.finFooterCell}>(   ) USD 150K</Text><Text style={[styles.finFooterCell, { borderRightWidth: 0 }]}>(   )ILIMITADO</Text></View>
          </View>
          <View style={styles.finBox}>
            <View style={styles.finHeader}><View style={styles.circle} /><Text style={styles.finTitle}>INÍCIO OU RETOMADA</Text></View>
            <View style={styles.finContent}>
              <Text>• Lucro Real OU Presumido</Text>
              <Text>• Iniciado/retomado atividades a menos de 5 anos</Text>
              <Text>• Pago IRPJ+CSLL+PIS+COFINS ou INSS (Últimos 6 meses):</Text>
              <Text>150k: R$ 27K (R$ 26.538) | Ilim: R$ 80K (R$ 79.614)</Text>
            </View>
            <View style={styles.finFooter}><Text style={styles.finFooterCell}>(   ) USD 150K</Text><Text style={[styles.finFooterCell, { borderRightWidth: 0 }]}>(   ) ILIMITADO</Text></View>
          </View>
        </View>

        <View style={styles.finGrid}>
          <View style={styles.finBox}>
            <View style={styles.finHeader}><View style={styles.circle} /><Text style={styles.finTitle}>RECEITA BRUTA (CPRB)</Text></View>
            <View style={styles.finContent}>
              <Text>• Optante por CPRB (Lucro Real ou Presumido)</Text>
              <Text>• Qualquer tempo de Empresa</Text>
              <Text>• Somatória da receita bruta dos ultimos 60 meses:</Text>
              <Text>- 150k: R$ 5.307.600 (média de 89k/mês)</Text>
              <Text>- Ilim: R$ 15.922.800 (média de 266k/mês)</Text>
            </View>
            <View style={styles.finFooter}><Text style={styles.finFooterCell}>(   ) USD 150K</Text><Text style={[styles.finFooterCell, { borderRightWidth: 0 }]}>(   ) ILIMITADO</Text></View>
          </View>
          <View style={styles.finBox}>
            <View style={styles.finHeader}><View style={styles.circle} /><Text style={styles.finTitle}>RECEITA BRUTA (DAS)</Text></View>
            <View style={styles.finContent}>
              <Text>• Simples Nacional</Text>
              <Text>• Qualquer tempo de Empresa</Text>
              <Text>• Somatória da receita bruta dos ultimos 60 meses:</Text>
              <Text>- 150k: R$ 5.307.600 (média de 89k/mês)</Text>
              <Text>- Ilim: R$ 15.922.800 (média de 266k/mês)</Text>
            </View>
            <View style={styles.finFooter}><Text style={styles.finFooterCell}>(   ) USD 150K</Text><Text style={[styles.finFooterCell, { borderRightWidth: 0 }]}>(   ) ILIMITADO</Text></View>
          </View>
        </View>

        <View style={styles.obsSection}>
          <Text style={[styles.cell, styles.titleCell, { textAlign: 'left', backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee' }]}>
            OBSERVAÇÕES
          </Text>
          <View style={{ padding: 8, minHeight: 60 }}>
            <Text style={[styles.value, { fontSize: 10, lineHeight: 1.4 }]}>
              {dados.extra?.observacoes || " "}
            </Text>
          </View>
        </View>

        <View style={styles.funilRow}>
          <Text>ETAPA DO FUNIL (CRM): (   ) Leads Frios  (   ) Stand-by  (   ) Em tratativa  (   ) Hot leads</Text>
        </View>
      </Page>
    </Document>
  );
};