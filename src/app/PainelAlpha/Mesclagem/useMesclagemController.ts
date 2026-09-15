"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CampoMapeamento, InspecaoPlanilha, PreviaMesclagem } from "@/lib/mesclagem";
import { criarMapeamentoInicial } from "@/lib/mesclagem/catalogo";
import {
  EXTENSOES_MESCLAGEM,
  baixarResultado,
  baixarResultadoHistorico,
  baixarTemplateMesclagem,
  inspecionarArquivo,
  prepararPrevia,
  sugerirMapeamento,
} from "./api-mesclagem";
import {
  mesclarSugestoesPreservandoManuais,
  reconciliarOverridesManuais,
  selecionarColunaCnpjDaAba,
} from "./workspace-state";

export type EtapaMesclagem = 1 | 2 | 3 | 4;
export type TipoArquivoMesclagemUi = "principal" | "complementar";
interface ArquivoInspecionado { arquivo: File; inspecao: InspecaoPlanilha }
type EstadoArquivos = Record<TipoArquivoMesclagemUi, ArquivoInspecionado | null>;
type ErrosArquivos = Record<TipoArquivoMesclagemUi, string | null>;

const NOMES_ARQUIVOS: Record<TipoArquivoMesclagemUi, string> = {
  principal: "planilha principal",
  complementar: "planilha complementar",
};

function extensaoSuportada(nome: string): boolean {
  const normalizado = nome.toLocaleLowerCase("pt-BR");
  return EXTENSOES_MESCLAGEM.some((extensao) => normalizado.endsWith(extensao));
}

export function useMesclagemController() {
  const [etapa, setEtapa] = useState<EtapaMesclagem>(1);
  const [arquivos, setArquivos] = useState<EstadoArquivos>({ principal: null, complementar: null });
  const [ultimosArquivos, setUltimosArquivos] = useState<Partial<Record<TipoArquivoMesclagemUi, File>>>({});
  const [errosArquivos, setErrosArquivos] = useState<ErrosArquivos>({ principal: null, complementar: null });
  const [carregandoArquivo, setCarregandoArquivo] = useState<TipoArquivoMesclagemUi | null>(null);
  const [abaPrincipal, setAbaPrincipal] = useState("");
  const [abaComplementar, setAbaComplementar] = useState("");
  const [colunaCnpjPrincipal, setColunaCnpjPrincipal] = useState(1);
  const [colunaCnpjComplementar, setColunaCnpjComplementar] = useState(1);
  const [mapeamento, setMapeamento] = useState<CampoMapeamento[]>(() => criarMapeamentoInicial());
  const [carregandoMapeamento, setCarregandoMapeamento] = useState(false);
  const [erroMapeamento, setErroMapeamento] = useState<string | null>(null);
  const [avisoMapeamento, setAvisoMapeamento] = useState<string | null>(null);
  const [mapeamentoUsouIa, setMapeamentoUsouIa] = useState(false);
  const [previa, setPrevia] = useState<PreviaMesclagem | null>(null);
  const [processando, setProcessando] = useState(false);
  const [baixandoTemplate, setBaixandoTemplate] = useState(false);
  const [gerado, setGerado] = useState(false);
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const [erroEtapa, setErroEtapa] = useState<number | null>(null);
  const requisicoesArquivo = useRef<Record<TipoArquivoMesclagemUi, number>>({ principal: 0, complementar: 0 });
  const requisicaoMapeamento = useRef(0);

  const principal = arquivos.principal;
  const complementar = arquivos.complementar;
  const ocupado = processando || carregandoArquivo !== null || carregandoMapeamento;
  const colunasComplementares = useMemo(
    () => complementar?.inspecao.abas.find((aba) => aba.nome === abaComplementar)?.colunas ?? [],
    [complementar, abaComplementar],
  );

  function invalidarDerivados(proximaEtapa: EtapaMesclagem = 1) {
    requisicaoMapeamento.current += 1;
    setEtapa(proximaEtapa);
    setMapeamento(criarMapeamentoInicial());
    setCarregandoMapeamento(false);
    setErroMapeamento(null);
    setAvisoMapeamento(null);
    setMapeamentoUsouIa(false);
    setPrevia(null);
    setGerado(false);
    setHistoricoId(null);
    setErroEtapa(null);
  }

  function limpar() {
    requisicoesArquivo.current.principal += 1;
    requisicoesArquivo.current.complementar += 1;
    setArquivos({ principal: null, complementar: null });
    setUltimosArquivos({});
    setErrosArquivos({ principal: null, complementar: null });
    setCarregandoArquivo(null);
    setAbaPrincipal("");
    setAbaComplementar("");
    setColunaCnpjPrincipal(1);
    setColunaCnpjComplementar(1);
    invalidarDerivados(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function selecionarArquivo(tipo: TipoArquivoMesclagemUi, arquivo: File) {
    const requisicao = ++requisicoesArquivo.current[tipo];
    setUltimosArquivos((atual) => ({ ...atual, [tipo]: arquivo }));
    setErrosArquivos((atual) => ({ ...atual, [tipo]: null }));
    if (!extensaoSuportada(arquivo.name)) {
      setArquivos((atual) => ({ ...atual, [tipo]: null }));
      setErrosArquivos((atual) => ({ ...atual, [tipo]: "Formato não suportado. Use XLSX, XLSM, CSV ou TSV." }));
      invalidarDerivados(1);
      return;
    }
    setCarregandoArquivo(tipo);
    setArquivos((atual) => ({ ...atual, [tipo]: null }));
    invalidarDerivados(1);
    try {
      const inspecao = await inspecionarArquivo(arquivo);
      if (requisicao !== requisicoesArquivo.current[tipo]) return;
      setArquivos((atual) => ({ ...atual, [tipo]: { arquivo, inspecao } }));
      const primeiraAba = inspecao.abas[0];
      if (tipo === "principal") {
        setAbaPrincipal(primeiraAba?.nome ?? "");
        setColunaCnpjPrincipal(primeiraAba ? selecionarColunaCnpjDaAba(inspecao, primeiraAba) : 1);
      } else {
        setAbaComplementar(primeiraAba?.nome ?? "");
        setColunaCnpjComplementar(primeiraAba ? selecionarColunaCnpjDaAba(inspecao, primeiraAba) : 1);
      }
      toast.success(`${NOMES_ARQUIVOS[tipo]} inspecionada.`);
    } catch (error) {
      if (requisicao !== requisicoesArquivo.current[tipo]) return;
      setErrosArquivos((atual) => ({ ...atual, [tipo]: error instanceof Error ? error.message : `Não foi possível inspecionar a ${NOMES_ARQUIVOS[tipo]}.` }));
      setErroEtapa(1);
    } finally {
      if (requisicao === requisicoesArquivo.current[tipo]) setCarregandoArquivo(null);
    }
  }

  function removerArquivo(tipo: TipoArquivoMesclagemUi) {
    requisicoesArquivo.current[tipo] += 1;
    setArquivos((atual) => ({ ...atual, [tipo]: null }));
    setUltimosArquivos((atual) => ({ ...atual, [tipo]: undefined }));
    setErrosArquivos((atual) => ({ ...atual, [tipo]: null }));
    if (carregandoArquivo === tipo) setCarregandoArquivo(null);
    invalidarDerivados(1);
  }

  async function calcularSugestoes(params?: {
    abas?: { principal?: string; complementar?: string };
    mapeamentoBase?: CampoMapeamento[];
  }): Promise<boolean> {
    if (!principal || !complementar) return false;
    const colunasPrincipal = principal.inspecao.abas.find((aba) => aba.nome === (params?.abas?.principal ?? abaPrincipal))?.colunas ?? [];
    const colunasComplementar = complementar.inspecao.abas.find((aba) => aba.nome === (params?.abas?.complementar ?? abaComplementar))?.colunas ?? [];
    const requisicao = ++requisicaoMapeamento.current;
    setCarregandoMapeamento(true);
    setErroMapeamento(null);
    try {
      const resultado = await sugerirMapeamento({ colunasPrincipal, colunasComplementar, mapeamento: params?.mapeamentoBase ?? mapeamento });
      if (requisicao !== requisicaoMapeamento.current) return false;
      setMapeamento((atual) => mesclarSugestoesPreservandoManuais(atual, resultado.mapeamento));
      setMapeamentoUsouIa(resultado.ia.aplicados > 0);
      if (["timeout", "falha", "resposta_invalida", "truncado"].includes(resultado.ia.status)) {
        setErroMapeamento("O complemento por IA local ficou indisponível, mas as correspondências diretas foram aplicadas.");
      }
    } catch {
      if (requisicao !== requisicaoMapeamento.current) return false;
      setErroMapeamento("As sugestões automáticas não ficaram disponíveis.");
      setMapeamentoUsouIa(false);
    } finally {
      if (requisicao === requisicaoMapeamento.current) setCarregandoMapeamento(false);
    }
    return requisicao === requisicaoMapeamento.current;
  }

  async function avancarParaMapeamento() {
    if (await calcularSugestoes()) setEtapa(3);
  }

  function trocarAba(tipo: TipoArquivoMesclagemUi, novaAba: string) {
    requisicaoMapeamento.current += 1;
    setCarregandoMapeamento(false);
    const arquivo = arquivos[tipo];
    const aba = arquivo?.inspecao.abas.find((item) => item.nome === novaAba);
    if (!arquivo || !aba) return;
    let mapeamentoBase = mapeamento;
    if (tipo === "principal") {
      setAbaPrincipal(novaAba);
      setColunaCnpjPrincipal(selecionarColunaCnpjDaAba(arquivo.inspecao, aba));
    } else {
      setAbaComplementar(novaAba);
      setColunaCnpjComplementar(selecionarColunaCnpjDaAba(arquivo.inspecao, aba));
      const reconciliado = reconciliarOverridesManuais(mapeamento, aba.colunas);
      mapeamentoBase = reconciliado.mapeamento;
      setMapeamento(mapeamentoBase);
      setAvisoMapeamento(reconciliado.descartados.length > 0
        ? `${reconciliado.descartados.length} override(s) foram limpos porque a coluna não existe de forma inequívoca na nova aba.`
        : null);
    }
    void calcularSugestoes({ abas: { [tipo]: novaAba }, mapeamentoBase });
    setPrevia(null);
    setGerado(false);
    setHistoricoId(null);
  }

  function atualizarColunaCnpj(tipo: TipoArquivoMesclagemUi, valor: number) {
    requisicaoMapeamento.current += 1;
    if (tipo === "principal") setColunaCnpjPrincipal(valor); else setColunaCnpjComplementar(valor);
    setPrevia(null);
    setGerado(false);
    setHistoricoId(null);
  }

  function atualizarCampo(campo: string, valor: number | null) {
    const origemNome = valor === null ? null : colunasComplementares.find((coluna) => coluna.numero === valor)?.nome ?? null;
    setMapeamento((atual) => atual.map((item) => item.destino === campo ? { ...item, origem: valor, origemNome, automatico: false, manual: true } : item));
    setPrevia(null);
    setGerado(false);
    setHistoricoId(null);
  }

  async function avancarParaRevisao() {
    if (!principal || !complementar) return;
    setProcessando(true);
    setErroEtapa(null);
    try {
      const novaPrevia = await prepararPrevia({ principal: principal.arquivo, complementar: complementar.arquivo, abaPrincipal, abaComplementar, colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento });
      setPrevia(novaPrevia);
      setEtapa(4);
      setGerado(false);
      setHistoricoId(null);
      toast.success("Prévia pronta para revisão.");
    } catch (error) {
      setErroEtapa(3);
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar a prévia.");
    } finally { setProcessando(false); }
  }

  async function baixar() {
    if (!principal || !complementar) return;
    setProcessando(true);
    setErroEtapa(null);
    try {
      const id = historicoId;
      if (id) {
        await baixarResultadoHistorico(id);
      } else {
        setHistoricoId(await baixarResultado({ principal: principal.arquivo, complementar: complementar.arquivo, abaPrincipal, abaComplementar, colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento }));
      }
      setGerado(true);
      toast.success(id ? "Resultado salvo baixado novamente." : "Planilha exportada e salva no histórico.");
    } catch (error) {
      setErroEtapa(4);
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar a planilha.");
    } finally { setProcessando(false); }
  }

  async function baixarTemplate() {
    setBaixandoTemplate(true);
    try { await baixarTemplateMesclagem(); toast.success("Template oficial baixado."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível baixar o template."); }
    finally { setBaixandoTemplate(false); }
  }

  return {
    etapa, setEtapa, principal, complementar, ultimosArquivos, errosArquivos, carregandoArquivo,
    abaPrincipal, abaComplementar, colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento,
    carregandoMapeamento, erroMapeamento, avisoMapeamento, mapeamentoUsouIa, previa, processando,
    baixandoTemplate, gerado, historicoId, erroEtapa, ocupado, colunasComplementares, selecionarArquivo,
    removerArquivo, calcularSugestoes, avancarParaMapeamento, trocarAba, atualizarColunaCnpj,
    atualizarCampo, avancarParaRevisao, baixar, baixarTemplate, limpar,
  };
}
