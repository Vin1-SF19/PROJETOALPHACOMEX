"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getTema } from "@/lib/temas";

import ModalButtons from "@/components/ComponentesRadar/BotoesModal";
import LoadingImport from "@/components/ComponentesRadar/ImportacaoLoading";
import ImportarPlanilha from "@/components/ComponentesRadar/ImportacaoLote";
import { ModalDetalhesEmpresa } from "@/components/ModalDetalhesEmpresa";
import ModalOpcoesReconsulta from "@/components/ComponentesRadar/BotaoReconsulta/BotaoReconsulta";
import {
  deletarRegistrosBanco,
  salvarConsultaIndividual,
  salvarPlanilhaCompleta,
  verificarCnpjsExistentes,
} from "@/actions/RadarAction";
import { prepararReconsultaLote } from "@/app/api/Reconsulta/ReconsultaRadar";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BarChart3, Loader2, Search, ShieldCheck, WifiOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmpresaRadar = {
  dataConsulta: string;
  cnpj: string;
  contribuinte: string;
  situacao: string;
  dataSituacao: string;
  submodalidade: string;
  razaoSocial: string;
  nomeFantasia: string;
  municipio: string;
  uf: string;
  dataConstituicao: string;
  regimeTributario: string;
  data_opcao: string;
  optante: boolean;
  capitalSocial: string;
  salvo?: boolean;
  origem?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: any) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
};

const fmtDisplay = (v: any) => {
  if (!v) return "N/A";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const normSub = (v: any) => String(v || "").toUpperCase();

const fmtBRL = (v: any) => {
  const num = Number(String(v || "0").replace(/[^\d,.]/g, "").replace(",", "."));
  if (!num || isNaN(num)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HabilitacaoRadarClient() {
  const { data: session } = useSession();

  const [temaNome, setTemaNome] = useState("blue");
  useEffect(() => {
    const saved = localStorage.getItem("alpha-theme-temp");
    const user = session?.user as any;
    setTemaNome(saved || user?.tema_interface || "blue");
  }, [session]);
  const visual = getTema(temaNome);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [cnpj, setCnpj] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaRadar[]>([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [totalLote, setTotalLote] = useState(0);
  const [processadas, setProcessadas] = useState(0);
  const [statusLote, setStatusLote] = useState("");
  const cancelarProcessamento = useRef<boolean>(false);
  const pausarRef = useRef<boolean>(false);
  const [infosimples, setInfosimples] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<any | null>(null);
  const [showModalReconsulta, setShowModalReconsulta] = useState(false);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filtroSituacao, setFiltroSituacao] = useState<
    "todos" | "DEFERIDA" | "NÃO HABILITADA" | "SUSPENSA" | "SEM STATUS"
  >("todos");
  const [filtroSubmodalidade, setFiltroSubmodalidade] = useState<
    "todos" | "LIMITADA (ATÉ US$ 50.000)" | "LIMITADA (ATÉ US$ 150.000)" | "ILIMITADA"
  >("todos");
  const [ordem, setOrdem] = useState<"todos" | "asc" | "desc" | null>(null);
  const [ordemData, setOrdemData] = useState<"todos" | "recentes" | "antigos" | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [filtroErro, setFiltroErro] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "erro" | "sucesso">("todos");

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => setIsOffline(!navigator.onLine);
    handle();
    window.addEventListener("online", handle);
    window.addEventListener("offline", handle);
    return () => {
      window.removeEventListener("online", handle);
      window.removeEventListener("offline", handle);
    };
  }, []);

  useEffect(() => {
    const buscar = async () => {
      try {
        const res = await fetch("/api/InfoSimples");
        setInfosimples(await res.json());
      } catch {}
    };
    buscar();
    const id = setInterval(buscar, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const empresasExibidas = useMemo(() => {
    let r = [...empresas];

    if (filtroSubmodalidade !== "todos") {
      r = r.filter((e) => {
        const s = normSub(e.submodalidade);
        if (filtroSubmodalidade === "LIMITADA (ATÉ US$ 50.000)")
          return s.includes("50.000") && !s.includes("150.000");
        if (filtroSubmodalidade === "LIMITADA (ATÉ US$ 150.000)")
          return s.includes("150.000");
        if (filtroSubmodalidade === "ILIMITADA")
          return s.includes("ILIMITADA") && !s.includes("50") && !s.includes("150");
        return true;
      });
    }

    if (filtroSituacao !== "todos") {
      r = r.filter((e) => {
        const s = (e.situacao || "").toUpperCase().trim();
        if (filtroSituacao === "SEM STATUS")
          return !e.razaoSocial || s === "" || s === "PENDENTE RADAR";
        return s === filtroSituacao.toUpperCase();
      });
    }

    if (ordem && ordem !== "todos") {
      r.sort((a, b) =>
        ordem === "asc"
          ? (a.razaoSocial || "").localeCompare(b.razaoSocial || "")
          : (b.razaoSocial || "").localeCompare(a.razaoSocial || "")
      );
    }

    if (ordemData && ordemData !== "todos") {
      r.sort((a, b) => {
        const p = (d: string) => {
          if (!d) return 0;
          return d.includes("-")
            ? new Date(d).getTime()
            : new Date(d.split("/").reverse().join("-")).getTime();
        };
        return ordemData === "recentes"
          ? p(b.dataConsulta) - p(a.dataConsulta)
          : p(a.dataConsulta) - p(b.dataConsulta);
      });
    }

    return r;
  }, [empresas, filtroSubmodalidade, filtroSituacao, ordem, ordemData]);

  const stats = useMemo(() => {
    const total = empresas.length;
    const deferidas = empresas.filter((e) =>
      ["DEFERIDA", "HABILITADA"].includes((e.situacao || "").toUpperCase())
    ).length;
    const falhas = empresas.filter(
      (e) => e.situacao === "ERRO" || e.razaoSocial === "NÃO ENCONTRADO"
    ).length;
    const sincronizados = empresas.filter((e) => e.salvo).length;
    const concluido =
      total > 0
        ? Math.round(
            (empresas.filter(
              (e) => e.situacao && e.situacao !== "" && e.situacao !== "PENDENTE RADAR"
            ).length /
              total) *
              100
          )
        : 0;
    const ate50k = empresas.filter(
      (e) => normSub(e.submodalidade).includes("50.000") && !normSub(e.submodalidade).includes("150.000")
    ).length;
    const ate150k = empresas.filter((e) => normSub(e.submodalidade).includes("150.000")).length;
    const ilimitada = empresas.filter(
      (e) =>
        normSub(e.submodalidade).includes("ILIMITADA") &&
        !normSub(e.submodalidade).includes("50") &&
        !normSub(e.submodalidade).includes("150")
    ).length;
    return { total, deferidas, falhas, sincronizados, concluido, ate50k, ate150k, ilimitada };
  }, [empresas]);

  const cnpjsSelecionadosNoBanco = useMemo(
    () =>
      Array.from(selecionados).filter(
        (c) => empresas.find((e) => e.cnpj === c)?.salvo === true
      ),
    [selecionados, empresas]
  );

  const [excluindoDoBanco, setExcluindoDoBanco] = useState(false);
  const [progressoExclusao, setProgressoExclusao] = useState({ atual: 0, total: 0 });

  // ── Handlers ────────────────────────────────────────────────────────────────
  function limparTabela() {
    setEmpresas([]);
    localStorage.removeItem("radar_dados");
  }

  function exportarExcel(nome: string) {
    if (empresas.length === 0) return toast.error("Nenhum dado para exportar");
    const rows = empresas.map((e) => ({
      "Data Consulta": fmtDisplay(e.dataConsulta),
      CNPJ: e.cnpj,
      Contribuinte: e.contribuinte || "",
      "Situação": e.situacao || "",
      "Data Situação": fmtDisplay(e.dataSituacao),
      Submodalidade: e.submodalidade || "",
      "Razão Social": e.razaoSocial || "",
      "Nome Fantasia": e.nomeFantasia || "",
      "Município": e.municipio || "",
      UF: e.uf || "",
      "Data Const.": fmtDisplay(e.dataConstituicao),
      Regime: e.regimeTributario || "",
      "Data Opção": fmtDisplay(e.data_opcao),
      "Capital Social": fmtBRL(e.capitalSocial),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Radar");
    XLSX.writeFile(wb, `${nome.trim() || "consulta_radar"}.xlsx`);
  }

  async function handleBuscar(
    cnpjOpcional?: string,
    isReconsulta = false,
    dadosOriginais?: any,
    isLote = false
  ) {
    const alvo = cnpjOpcional || cnpj;
    if (!alvo) return null;
    const limpo = String(alvo).replace(/\D/g, "").trim();

    try {
      if (!cnpjOpcional) {
        setLoading(true);
        setTotalLote(1);
        setProcessadas(0);
      }
      if (isLote) await new Promise((r) => setTimeout(r, Math.random() * 500 + 400));

      if (!isReconsulta && !isLote) {
        try {
          const resBanco = await fetch("/api/BuscaLote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cnpjs: [limpo] }),
          });
          if (resBanco.ok) {
            const dados = await resBanco.json();
            if (dados?.length > 0 && dados[0].razao_social) {
              const r = dados[0];
              const f: EmpresaRadar = {
                dataConsulta:     fmt(r.data_consulta),
                cnpj:             r.cnpj,
                contribuinte:     r.contribuinte || "",
                situacao:         r.situacao_radar || "",
                dataSituacao:     fmt(r.data_situacao),
                submodalidade:    r.submodalidade || "",
                razaoSocial:      r.razao_social,
                nomeFantasia:     r.nome_fantasia || "",
                municipio:        r.municipio || "",
                uf:               r.uf || "",
                dataConstituicao: fmt(r.data_constituicao),
                regimeTributario: r.regime_tributario || "",
                data_opcao:       fmt(r.data_opcao),
                optante:          r.optante_simples ?? false,
                capitalSocial:    r.capital_social || "",
                salvo:            true,
              };
              setEmpresas((prev) => [...prev.filter((e) => e.cnpj !== limpo), f]);
              return f;
            }
          }
        } catch {}
      }

      const resApi = await fetch(`/api/ConsultaCompleta?cnpj=${limpo}`, { cache: "no-store" });
      if (!resApi.ok) throw new Error("Falha na API");
      const empresa = await resApi.json();

      const novo: EmpresaRadar = {
        dataConsulta:     dadosOriginais?.dataConsulta || fmt(empresa.data_consulta) || fmt(new Date()),
        cnpj:             limpo,
        contribuinte:     empresa.contribuinte || dadosOriginais?.contribuinte || "",
        situacao:         empresa.situacao      || empresa.situacao_radar      || dadosOriginais?.situacao || "ATIVO",
        dataSituacao:     fmt(empresa.dataSituacao     || empresa.data_situacao     || dadosOriginais?.dataSituacao),
        submodalidade:    empresa.submodalidade  || dadosOriginais?.submodalidade || "",
        razaoSocial:      empresa.razaoSocial    || empresa.razao_social         || dadosOriginais?.razaoSocial || "NÃO ENCONTRADO",
        nomeFantasia:     empresa.nomeFantasia   || empresa.nome_fantasia         || dadosOriginais?.nomeFantasia || "",
        municipio:        empresa.municipio      || dadosOriginais?.municipio || "",
        uf:               empresa.uf             || dadosOriginais?.uf || "",
        dataConstituicao: fmt(empresa.dataConstituicao || empresa.data_constituicao || dadosOriginais?.dataConstituicao),
        regimeTributario: empresa.regimeTributario || empresa.regime_tributario   || dadosOriginais?.regimeTributario || "",
        optante:          empresa.optante ?? empresa.optante_simples ?? false,
        data_opcao:       fmt(empresa.data_opcao || dadosOriginais?.data_opcao),
        capitalSocial:    empresa.capitalSocial  || empresa.capital_social       || dadosOriginais?.capitalSocial || "",
      };
      setEmpresas((prev) => [...prev.filter((e) => e.cnpj !== limpo), novo]);
      const resSalvar = await salvarConsultaIndividual(novo);
      if (resSalvar.success) {
        novo.salvo = true;
        setEmpresas((prev) =>
          prev.map((e) => (e.cnpj === limpo ? { ...e, salvo: true } : e))
        );
      }
      return novo;
    } catch {
      return null;
    } finally {
      if (!cnpjOpcional) setLoading(false);
    }
  }

  async function handleImportarHistorico(ids: number[]) {
    if (!ids.length) return;
    const res = await fetch("/api/ImportarHistorico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const registros = await res.json();
    setEmpresas((prev) => {
      const existentes = new Set(prev.map((e) => e.cnpj));
      const novos = registros
        .filter((r: any) => !existentes.has(r.cnpj))
        .map((r: any, i: number) => ({
          numero: prev.length + i + 1,
          dataConsulta: r.data_consulta
            ? new Date(r.data_consulta).toLocaleDateString("pt-BR")
            : "-",
          cnpj: r.cnpj,
          contribuinte: r.contribuinte,
          situacao: r.situacao_radar,
          dataSituacao: r.data_situacao
            ? new Date(r.data_situacao).toLocaleDateString("pt-BR")
            : "-",
          submodalidade: r.submodalidade,
          razaoSocial: r.razao_social,
          nomeFantasia: r.nome_fantasia,
          municipio: r.municipio,
          uf: r.uf,
          dataConstituicao: r.data_constituicao
            ? new Date(r.data_constituicao).toLocaleDateString("pt-BR")
            : "-",
          regimeTributario: r.regime_tributario,
          data_opcao: r.data_opcao
            ? new Date(r.data_opcao).toLocaleDateString("pt-BR", { timeZone: "UTC" })
            : "N/A",
          capitalSocial: r.capital_social,
          optante: false,
        }));
      return [...prev, ...novos];
    });
  }

  const handleReconsultarErros = async () => {
    setShowModalReconsulta(false);
    const alvo = empresas.filter((e) => {
      const s = (e.situacao || "").toUpperCase().trim();
      return (
        !e.razaoSocial ||
        s === "" ||
        s === "ERRO" ||
        s === "PENDENTE RADAR" ||
        s === "ERRO NA CONSULTA"
      );
    });
    if (!alvo.length) return toast.info("Nenhum erro pendente.");

    setProcessando(true);
    setLoading(true);
    setTotalLote(alvo.length);
    setProcessadas(0);
    cancelarProcessamento.current = false;

    for (let i = 0; i < alvo.length; i++) {
      if (isOffline) {
        setStatusLote("PAUSADO: Aguardando conexão...");
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      if (cancelarProcessamento.current) break;

      const emp = alvo[i];
      const c = String(emp.cnpj).replace(/\D/g, "").padStart(14, "0");
      let ok = false;
      let t = 0;

      while (!ok && t < 10) {
        setStatusLote(`${i + 1}/${alvo.length} (T.${t + 1}/10): ${c}`);
        try {
          const res = await fetch(
            `/api/ConsultaCompleta?cnpj=${c}&forcar=true&t=${Date.now()}`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error();
          const api = await res.json();
          if (api.salvo !== false) {
            setEmpresas((prev) =>
              prev.map((e) => (e.cnpj === emp.cnpj ? { ...e, ...api } : e))
            );
            ok = true;
          } else throw new Error();
        } catch {
          t++;
          if (t < 10) await new Promise((r) => setTimeout(r, 25000));
        }
      }
      setProcessadas(i + 1);
      await new Promise((r) => setTimeout(r, 5000));
    }

    setProcessando(false);
    setLoading(false);
    setStatusLote("Processamento finalizado!");
    toast.success("Reconsulta concluída!");
  };

  const esperarResumido = async () => {
    while (pausarRef.current && !cancelarProcessamento.current) {
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const handlePausar = () => {
    pausarRef.current = true;
    setPausado(true);
    setStatusLote("PAUSADO — clique em retomar para continuar");
  };

  const handleRetomar = () => {
    pausarRef.current = false;
    setPausado(false);
  };

  const handleImportarLote = async (dadosNovos: EmpresaRadar[]) => {
    const existentes = new Set(
      empresas.map((e) => String(e.cnpj).replace(/\D/g, "").padStart(14, "0"))
    );
    const filtrados = dadosNovos.reduce((acc: EmpresaRadar[], item) => {
      const c = String(item.cnpj).replace(/\D/g, "").padStart(14, "0").substring(0, 14);
      if (c && !existentes.has(c) && !acc.some((e) => e.cnpj === c))
        acc.push({ ...item, cnpj: c, salvo: false });
      return acc;
    }, []);

    if (!filtrados.length) return toast.info("Registros já estão na tela.");

    setLoading(true);
    setProcessadas(0);
    setTotalLote(filtrados.length);
    setProcessando(true);
    setStatusLote("Verificando banco de dados...");
    const tid = toast.loading("Sincronizando com o banco Alpha...");

    try {
      // ── Fase 1: consulta banco em chunks (SQLite limit = 200/query) ──
      const CHUNK = 200;
      const encontradosMap = new Map<string, EmpresaRadar>();
      const cnpjsFiltrados = filtrados.map((i) => i.cnpj);

      for (let i = 0; i < cnpjsFiltrados.length; i += CHUNK) {
        await esperarResumido();
        if (cancelarProcessamento.current) break;

        setStatusLote(`Verificando banco... ${Math.min(i + CHUNK, filtrados.length).toLocaleString()} / ${filtrados.length.toLocaleString()}`);
        const chunk = cnpjsFiltrados.slice(i, i + CHUNK);
        const res = await verificarCnpjsExistentes(chunk);
        if (res.success) {
          for (const d of res.data) {
            encontradosMap.set(d.cnpj, d as unknown as EmpresaRadar);
          }
        }
        setProcessadas(Math.min(i + CHUNK, filtrados.length));
      }

      if (cancelarProcessamento.current) {
        toast.error("Importação cancelada.", { id: tid });
        setEmpresas((prev) => [...prev, ...filtrados.map((f) => ({ ...f, salvo: false }))]);
        return;
      }

      const resultados: EmpresaRadar[] = filtrados.map((item) => {
        const db = encontradosMap.get(item.cnpj);
        return db ? { ...item, ...db, salvo: true } : { ...item, salvo: false };
      });

      const novos = resultados.filter((e) => !e.salvo);
      setEmpresas((prev) => [...prev, ...resultados]);

      if (novos.length === 0) {
        toast.success(`${resultados.length} registros recuperados do banco.`, { id: tid });
        return;
      }

      toast.loading(
        `${resultados.length - novos.length} no banco · ${novos.length} sendo consultados na Receita...`,
        { id: tid }
      );

      // ── Fase 2: API externa só para CNPJs novos ──
      setTotalLote(novos.length);
      setProcessadas(0);

      for (let i = 0; i < novos.length; i++) {
        await esperarResumido();
        if (cancelarProcessamento.current) break;

        const item = novos[i];
        setStatusLote(`Consultando Receita... ${i + 1} / ${novos.length}`);
        setProcessadas(i + 1);

        try {
          const r = await fetch(`/api/ConsultaCompleta?cnpj=${item.cnpj}`);
          if (r.ok) {
            const d = await r.json();
            setEmpresas((prev) =>
              prev.map((e) => (e.cnpj === item.cnpj ? { ...e, ...d, salvo: true } : e))
            );
          }
        } catch {}
      }

      if (cancelarProcessamento.current) {
        toast.error("Consulta interrompida.", { id: tid });
      } else {
        toast.success(`Importação concluída! ${novos.length} consultados na Receita.`, { id: tid });
      }
    } catch {
      toast.error("Erro ao processar lote", { id: tid });
      setEmpresas((prev) => [...prev, ...filtrados]);
    } finally {
      cancelarProcessamento.current = false;
      pausarRef.current = false;
      setPausado(false);
      setLoading(false);
      setProcessando(false);
      setStatusLote("");
    }
  };

  const handleSalvarNoBanco = async (nome: string) => {
    if (empresas.some((e) => e.situacao === "ERRO")) {
      toast.error("Existem itens com erro na tabela.");
      return;
    }
    setLoading(true);
    const tid = toast.loading("Sincronizando com a nuvem...");
    try {
      const res = (await salvarPlanilhaCompleta(empresas, nome)) as any;
      if (res?.success) {
        const n = res.novos || 0;
        const ex = res.existentes || 0;
        if (n === 0 && ex > 0) toast.info("Todos os dados já estão na nuvem!", { id: tid });
        else
          toast.success(`${n} novos salvos. (${ex} já estavam)`, {
            id: tid,
            duration: 5000,
          });
      } else {
        toast.error(res?.error || "Erro ao salvar.", { id: tid });
      }
    } catch {
      toast.error("Falha na conexão.", { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarExclusaoDoBanco = async () => {
    const alvo = cnpjsSelecionadosNoBanco;
    if (!alvo.length) return;

    setExcluindoDoBanco(true);
    setProgressoExclusao({ atual: 0, total: alvo.length });

    let excluidos = 0;
    let naoEncontrados = 0;

    for (let i = 0; i < alvo.length; i++) {
      const c = alvo[i];
      const res = await deletarRegistrosBanco([c]);
      if (res.success && res.count > 0) {
        excluidos++;
        setEmpresas((prev) =>
          prev.map((e) => (e.cnpj === c ? { ...e, salvo: false } : e))
        );
      } else if (res.success) {
        naoEncontrados++;
      }
      setProgressoExclusao({ atual: i + 1, total: alvo.length });
    }

    setSelecionados(new Set());

    if (excluidos > 0 && naoEncontrados === 0) {
      toast.success(`${excluidos} registro${excluidos !== 1 ? "s" : ""} excluído${excluidos !== 1 ? "s" : ""} do banco.`);
    } else if (excluidos > 0) {
      toast.success(`${excluidos} excluído${excluidos !== 1 ? "s" : ""}. ${naoEncontrados} já não estava${naoEncontrados !== 1 ? "m" : ""} no banco.`);
    } else {
      toast.error("Nenhum registro foi encontrado no banco para excluir.");
    }

    setExcluindoDoBanco(false);
  };

  const handleAlternarOrdemNome = () => {
    setOrdemData(null);
    setOrdem((p) => (p === "asc" ? "desc" : p === "desc" ? null : "asc"));
  };

  const handleAlternarOrdemData = () => {
    setOrdem(null);
    setOrdemData((p) => (p === "recentes" ? "antigos" : p === "antigos" ? null : "recentes"));
  };

  const handleRemoverSelecionados = () => {
    setEmpresas((prev) => prev.filter((e) => !selecionados.has(e.cnpj)));
    setSelecionados(new Set());
    toast.success("Itens removidos.");
  };

  const handleSelecionarTudo = () => {
    if (selecionados.size === empresasExibidas.length)
      setSelecionados(new Set());
    else
      setSelecionados(new Set(empresasExibidas.map((e) => e.cnpj)));
  };

  const toggleSelecionarUm = (c: string) => {
    const n = new Set(selecionados);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    setSelecionados(n);
  };

  // ── Status badge helper ──────────────────────────────────────────────────────
  const statusBadge = (situacao: string) => {
    const s = (situacao || "").toUpperCase();
    if (["DEFERIDA", "HABILITADA", "ATIVO"].includes(s))
      return "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
    if (s === "NÃO HABILITADA" || s === "SUSPENSA")
      return "text-orange-400 bg-orange-500/10 border border-orange-500/20";
    return "text-rose-400 bg-rose-500/10 border border-rose-500/20";
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen text-white space-y-5 px-3 md:px-6 py-6 md:py-8">

      {/* ── Offline banner ─────────────────────────────────────────────────── */}
      {isOffline && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500]">
          <div className="bg-rose-600/90 backdrop-blur-xl border border-rose-400/30 px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(225,29,72,0.4)] flex items-center gap-3">
            <WifiOff size={18} className="text-white animate-pulse" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest">Conexão Interrompida</p>
              <p className="text-[9px] text-rose-100 uppercase opacity-70">Tentando restabelecer...</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="relative flex flex-col gap-4 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden border"
        style={{ borderColor: `rgba(${visual.accent},0.2)`, background: "rgba(2,6,23,0.8)" }}
      >
        <div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: `rgb(${visual.accent})` }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="p-2.5 rounded-2xl shadow-lg"
                style={{ background: `rgba(${visual.accent},0.15)`, border: `1px solid rgba(${visual.accent},0.3)` }}
              >
                <ShieldCheck className="w-5 h-5" style={{ color: `rgb(${visual.accent})` }} />
              </div>
              <span
                className="text-[9px] font-black uppercase tracking-[0.4em] opacity-70"
                style={{ color: `rgb(${visual.accent})` }}
              >
                Sistema Operacional Alpha
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase">
              CONSULTA{" "}
              <span style={{ color: `rgb(${visual.accent})` }}>RADAR</span>{" "}
              ALPHA
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              Gestão de habilitações RADAR — consulta unitária, importação em lote,
              sincronização com banco Alpha e exportação de dados.
            </p>
          </div>
        </div>

        {/* InfoSimples strip */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-3 px-4 h-11 bg-black/30 backdrop-blur-sm rounded-xl border transition-all"
            style={{
              borderColor:
                infosimples?.saldo < 100
                  ? "rgba(239,68,68,0.4)"
                  : "rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-black text-slate-500 tracking-widest">
                Saldo InfoSimples
              </span>
              <span
                className="text-sm font-mono font-black"
                style={{ color: infosimples?.saldo < 100 ? "#f87171" : "#34d399" }}
              >
                {isOffline ? (
                  <span className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Loader2 size={10} className="animate-spin" /> OFFLINE
                  </span>
                ) : (
                  `R$ ${Number(infosimples?.saldo || 0).toFixed(2)}`
                )}
              </span>
            </div>
            {infosimples?.consumo !== undefined && (
              <>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col hidden sm:flex">
                  <span className="text-[7px] uppercase font-bold text-slate-600">Consumo mensal</span>
                  <span
                    className="text-[10px] font-black italic"
                    style={{ color: `rgb(${visual.accent})` }}
                  >
                    R$ {Number(infosimples.consumo).toFixed(0)}
                  </span>
                </div>
              </>
            )}
            <span
              className="h-2 w-2 rounded-full ml-1"
              style={{
                background:
                  infosimples?.saldo < 100 ? "#ef4444" : "#10b981",
                animation: infosimples?.saldo < 100 ? "ping 1s linear infinite" : "none",
              }}
            />
          </div>

          <a
            href="https://servicos.receita.fazenda.gov.br/servicos/radar/consultaSituacaoCpfCnpj.asp"
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
          >
            🌐 Receita Federal
          </a>

          <div className="ml-auto flex items-center gap-2 bg-black/20 px-3 h-9 rounded-xl border border-white/5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: isOffline ? "#ef4444" : "#10b981",
                animation: isOffline ? "ping 1s linear infinite" : "none",
              }}
            />
            <span
              className="text-[9px] font-black uppercase"
              style={{ color: isOffline ? "#f87171" : "#34d399" }}
            >
              {isOffline ? "Offline" : "Online"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Stats grid ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: `rgb(${visual.accent})`, sub: "registros" },
          { label: "Deferidas", value: stats.deferidas, color: "#34d399", sub: "habilitadas" },
          { label: "Falhas", value: stats.falhas, color: "#f87171", sub: "com erro" },
          { label: "Sincronizados", value: stats.sincronizados, color: "#c084fc", sub: "no banco" },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-slate-950/60 rounded-2xl p-4 flex flex-col border"
            style={{ borderColor: `rgba(${visual.accent},0.15)` }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {c.label}
            </span>
            <span className="text-3xl font-black mt-1" style={{ color: c.color }}>
              {c.value}
            </span>
            <span className="text-[9px] text-slate-600 uppercase mt-0.5">{c.sub}</span>
          </div>
        ))}
      </section>

      {/* Submodalidade breakdown */}
      <div
        className="grid grid-cols-3 gap-3 p-4 rounded-2xl border"
        style={{ borderColor: `rgba(${visual.accent},0.12)`, background: "rgba(2,6,23,0.5)" }}
      >
        {[
          { label: "Até US$ 50k", value: stats.ate50k, color: "#93c5fd" },
          { label: "Até US$ 150k", value: stats.ate150k, color: "#fdba74" },
          { label: "Ilimitada", value: stats.ilimitada, color: "#c084fc" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
              {s.label}
            </span>
            <span className="text-xl font-black" style={{ color: s.color }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Consulta + Monitor ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Consulta individual + importar */}
        <div
          className="space-y-4 bg-slate-950/60 rounded-3xl p-6 shadow-lg border"
          style={{ borderColor: `rgba(${visual.accent},0.15)` }}
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
            Consulta &amp; Importação
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              CNPJ Individual
            </label>
            <div className="flex gap-2">
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                placeholder="00.000.000/0000-00"
                className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-slate-100 outline-none focus:border-white/20 transition-all text-sm"
              />
              <button
                onClick={() => handleBuscar()}
                disabled={loading || !cnpj.trim()}
                className="px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: `rgba(${visual.accent},0.8)` }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {loading ? "..." : "Consultar"}
              </button>
            </div>
          </div>

          <ImportarPlanilha
            onImportar={handleImportarLote}
            processando={processando}
            onCancelar={() => {
              cancelarProcessamento.current = true;
              pausarRef.current = false;
              setPausado(false);
              setProcessando(false);
              setStatusLote("Operação cancelada.");
            }}
            statusLote={statusLote}
            processadas={processadas}
            totalLote={totalLote}
          />
        </div>

        {/* Monitor de processamento */}
        <div
          className="bg-slate-950/60 rounded-3xl p-6 shadow-lg border flex flex-col gap-4"
          style={{ borderColor: `rgba(${visual.accent},0.15)` }}
        >
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-2xl border transition-all"
              style={
                processando
                  ? {
                      background: `rgba(${visual.accent},0.08)`,
                      borderColor: `rgba(${visual.accent},0.3)`,
                      animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                    }
                  : { background: "rgba(30,41,59,0.4)", borderColor: "rgba(255,255,255,0.05)" }
              }
            >
              <BarChart3
                size={24}
                style={{ color: processando ? `rgb(${visual.accent})` : "#475569" }}
              />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-white">
                Monitor de Processamento
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                {processando ? "Robô em execução" : "Aguardando comando"} •{" "}
                {stats.total} registros
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="bg-black/20 border border-white/5 p-3 rounded-2xl flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Concluído
              </span>
              <span
                className="text-2xl font-black mt-1"
                style={{ color: `rgb(${visual.accent})` }}
              >
                {stats.concluido}%
              </span>
            </div>
            <div className="bg-black/20 border border-white/5 p-3 rounded-2xl flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Deferidos
              </span>
              <span className="text-2xl font-black mt-1 text-emerald-400">
                {stats.deferidas}
              </span>
            </div>
          </div>

          <LoadingImport
            totalLote={totalLote}
            processadas={processadas}
            statusLote={statusLote}
            processando={processando || loading}
            pausado={pausado}
            onPausar={handlePausar}
            onRetomar={handleRetomar}
            onCancelar={() => {
              cancelarProcessamento.current = true;
              pausarRef.current = false;
              setPausado(false);
              setProcessando(false);
              setStatusLote("Cancelando...");
              setLoading(false);
            }}
          />
        </div>
      </section>

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <ModalButtons
        onImportarHistorico={handleImportarHistorico}
        onLimparTabela={limparTabela}
        onExportarExcel={exportarExcel}
        onReconsultarErros={handleReconsultarErros}
        processando={processando}
        onSalvarBanco={handleSalvarNoBanco}
        empresas={empresas}
        selecionados={selecionados}
        ordem={ordem}
        ordemData={ordemData}
        empresasExibidas={empresasExibidas}
        handleAlternarOrdemNome={handleAlternarOrdemNome}
        handleAlternarOrdemData={handleAlternarOrdemData}
        handleRemoverSelecionados={handleRemoverSelecionados}
        handleSelecionarTudo={handleSelecionarTudo}
        filtroErro={filtroErro}
        setFiltroErro={setFiltroErro}
        loading={loading}
        totalEmpresas={stats.total}
        filtroStatus={filtroStatus}
        setFiltroStatus={setFiltroStatus}
        filtroSituacao={filtroSituacao}
        setFiltroSituacao={setFiltroSituacao}
        cnpjsSelecionadosNoBanco={cnpjsSelecionadosNoBanco}
        excluindoDoBanco={excluindoDoBanco}
        progressoExclusao={progressoExclusao}
        onIniciarExclusaoDoBanco={handleIniciarExclusaoDoBanco}
        setOrdem={setOrdem}
        setOrdemData={setOrdemData}
        totalSelecionados={selecionados.size}
        onAbrirReconsulta={() => setShowModalReconsulta(true)}
        filtroSubmodalidade={filtroSubmodalidade}
        setFiltroSubmodalidade={setFiltroSubmodalidade}
        tema={temaNome}
      />

      <ModalOpcoesReconsulta
        isOpen={showModalReconsulta}
        onClose={() => setShowModalReconsulta(false)}
        onExecutar={handleReconsultarErros}
      />

      {/* ── Tabela ─────────────────────────────────────────────────────────── */}
      <div
        className="w-full rounded-2xl border bg-slate-950/80 shadow-2xl overflow-hidden"
        style={{ borderColor: `rgba(${visual.accent},0.15)` }}
      >
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: `rgba(${visual.accent},0.12)` }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {empresasExibidas.length} registro
            {empresasExibidas.length !== 1 ? "s" : ""} exibidos
          </span>
          {selecionados.size > 0 && (
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: `rgb(${visual.accent})` }}
            >
              {selecionados.size} selecionado{selecionados.size !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center">
            <thead>
              <tr
                className="text-[9px] uppercase tracking-widest"
                style={{ background: "rgba(15,23,42,0.6)", borderBottom: `1px solid rgba(${visual.accent},0.12)` }}
              >
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    style={{ accentColor: `rgb(${visual.accent})` }}
                    checked={
                      selecionados.size === empresasExibidas.length &&
                      empresasExibidas.length > 0
                    }
                    onChange={handleSelecionarTudo}
                  />
                </th>
                {[
                  "N°", "Consulta", "CNPJ", "Contribuinte", "Situação",
                  "Data Sit.", "Submodal.", "Razão Social", "Fantasia",
                  "Município", "UF", "Const.", "Regime", "Dt. Opção", "Capital",
                ].map((col) => (
                  <th key={col} className="p-2 font-black text-slate-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.04]">
              {empresasExibidas.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-20 text-slate-600 text-sm italic">
                    Nenhum registro. Importe uma planilha ou consulte um CNPJ.
                  </td>
                </tr>
              ) : (
                empresasExibidas.map((empresa, index) => (
                  <tr
                    key={empresa.cnpj}
                    onClick={() => setEmpresaSelecionada(empresa)}
                    className="cursor-pointer transition-all text-[9px] md:text-[10px]"
                    style={{
                      background: selecionados.has(empresa.cnpj)
                        ? `rgba(${visual.accent},0.08)`
                        : empresa.salvo
                        ? "rgba(147,51,234,0.06)"
                        : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!selecionados.has(empresa.cnpj))
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = selecionados.has(
                        empresa.cnpj
                      )
                        ? `rgba(${visual.accent},0.08)`
                        : empresa.salvo
                        ? "rgba(147,51,234,0.06)"
                        : "";
                    }}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        style={{ accentColor: `rgb(${visual.accent})` }}
                        checked={selecionados.has(empresa.cnpj)}
                        onChange={() => toggleSelecionarUm(empresa.cnpj)}
                      />
                    </td>
                    <td className="p-2 text-slate-600">{index + 1}</td>
                    <td className="p-2 text-slate-400">{fmtDisplay(empresa.dataConsulta)}</td>
                    <td
                      className="p-2 font-bold"
                      style={{ color: `rgb(${visual.accent})` }}
                    >
                      {empresa.cnpj}
                    </td>
                    <td className="p-2 truncate max-w-[80px] text-slate-300">
                      {empresa.contribuinte}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-black ${statusBadge(empresa.situacao)}`}
                      >
                        {empresa.situacao || "SEM STATUS"}
                      </span>
                    </td>
                    <td className="p-2 text-slate-400">{fmtDisplay(empresa.dataSituacao)}</td>
                    <td className="p-2 text-slate-300 truncate max-w-[100px]">
                      {empresa.submodalidade}
                    </td>
                    <td className="p-2 truncate max-w-[120px] text-slate-200">
                      {empresa.razaoSocial}
                    </td>
                    <td className="p-2 truncate max-w-[80px] text-slate-400">
                      {empresa.nomeFantasia}
                    </td>
                    <td className="p-2 text-slate-400">{empresa.municipio}</td>
                    <td className="p-2 text-slate-500">{empresa.uf}</td>
                    <td className="p-2 text-slate-400">
                      {fmtDisplay(empresa.dataConstituicao)}
                    </td>
                    <td className="p-2 text-slate-400">{empresa.regimeTributario}</td>
                    <td className="p-2 text-slate-400">
                      {fmtDisplay(empresa.data_opcao || "N/A")}
                    </td>
                    <td className="p-2 text-slate-400 whitespace-nowrap">{fmtBRL(empresa.capitalSocial)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalDetalhesEmpresa
        empresa={empresaSelecionada}
        open={!!empresaSelecionada}
        onOpenChange={(aberto: boolean) => !aberto && setEmpresaSelecionada(null)}
      />
    </div>
  );
}
