import { fetchComProduto } from './alpha-catcher-bi.mjs';
import { fetchComPeriodo } from './alpha-catcher-filters.mjs';
export async function compararRanking({ credentials, cliente, periodo, min, max, janelaMeses, publicar = value => console.log(typeof value === 'string' ? value : JSON.stringify(value)) }) {
    const redigir = value => {
      let texto = String(value);
      for (const secret of [credentials.token, credentials.authorizationHeader, credentials.infraKey, credentials.email]) if (secret) texto = texto.split(secret).join('[REMOVIDO]');
      return texto.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]').slice(0, 600);
    };
    await publicar({ periodo, min, max, produto: credentials.productSignature || 'legado' });
    for (const caso of [{ nome: 'header_legado', legado: true, faixa: [min, max] }, { nome: 'original', faixa: [min, max] }, { nome: 'periodo_exato', faixa: [min, max], periodo }, { nome: 'tres_meses_mesmo_fim', faixa: [min, max], periodo: janelaMeses(periodo.dataFinal, 3) }, { nome: 'periodo_exato_sem_faixa', periodo }]) {
      const observar = async (url, options) => {
        const resposta = await fetch(url, options);
        if (!resposta.ok) {
          let campos = [], motivo;
          try { const body = await resposta.clone().json(); campos = Object.keys(body); for (const key of ['message', 'error', 'detail']) if (typeof body[key] === 'string') { motivo = redigir(body[key]); break; } } catch {}
          await publicar({ caso: caso.nome, http: resposta.status, contentType: resposta.headers.get('content-type'), campos, motivo });
        }
        return resposta;
      };
      const enviar = caso.legado ? observar : fetchComProduto(credentials, observar, credentials.productSignature || 'bi-importacao');
      const api = cliente({ ...credentials, fetcher: caso.periodo ? fetchComPeriodo(caso.periodo, enviar) : enviar });
      try { const ranking = await api.ranking(periodo.dataFinal, 1, caso.faixa); await publicar({ caso: caso.nome, http: 200, formatoRankingValido: Array.isArray(ranking?.result?.[0]?.data), empresasNaPagina: ranking?.result?.[0]?.data?.length }); }
      catch (e) { await publicar({ caso: caso.nome, falhaHttp: Number.isInteger(e.status) ? e.status : null }); }
    }
}
