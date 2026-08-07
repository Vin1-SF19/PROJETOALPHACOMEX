import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ContactRound,
  FileBadge,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DadosEmpresaConsolidado } from "@/lib/bpm/dados-empresa";

interface DadosEmpresaConteudoProps {
  dados: DadosEmpresaConsolidado;
  accent: string;
}

interface SecaoProps {
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

function Secao({ titulo, descricao, icon: Icon, children }: SecaoProps) {
  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-300">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-white">{titulo}</h2>
          <p className="mt-1 text-xs text-slate-500">{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{rotulo}</p>
      <div className="mt-1.5 break-words text-sm font-semibold text-slate-200">{valor || "Não informado"}</div>
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">{texto}</p>;
}

function formatarMoeda(valor: number | null): string {
  return valor === null ? "Não informado" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SimNao({ valor }: { valor: boolean | null }) {
  return <>{valor === null ? "Não informado" : valor ? "Sim" : "Não"}</>;
}

export function DadosEmpresaConteudo({ dados, accent }: DadosEmpresaConteudoProps) {
  const endereco = [dados.empresa.endereco.logradouro, dados.empresa.endereco.numero, dados.empresa.endereco.bairro]
    .filter(Boolean)
    .join(", ");
  const localidade = [dados.empresa.endereco.municipio, dados.empresa.endereco.uf].filter(Boolean).join(" / ");

  return (
    <div className="grid w-full grid-cols-1 gap-3 p-3">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: `rgb(${accent})` }} />
        <div className="grid gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Fonte: {dados.fonteCartaoCnpj}
              </span>
              {dados.empresa.situacao && (
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                  {dados.empresa.situacao}
                </span>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-white">{dados.empresa.razaoSocial}</h1>
            <p className="mt-1 text-sm text-slate-400">{dados.empresa.nomeFantasia || "Sem nome fantasia"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="CNPJ" valor={<span className="font-mono">{dados.empresa.cnpj}</span>} />
            <Campo rotulo="Capital social" valor={formatarMoeda(dados.empresa.capitalSocial)} />
          </div>
        </div>
      </section>

      <Secao titulo="Dados cadastrais" descricao="Cartão CNPJ e cadastro interno" icon={Building2}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data de abertura" valor={dados.empresa.dataConstituicao} />
          <Campo rotulo="Porte" valor={dados.empresa.porte} />
          <Campo rotulo="Natureza jurídica" valor={dados.empresa.naturezaJuridica} />
          <Campo rotulo="CEP" valor={dados.empresa.endereco.cep} />
          <Campo rotulo="Endereço" valor={endereco || null} />
          <Campo rotulo="Município / UF" valor={localidade || null} />
        </div>
      </Secao>

      <Secao titulo="Relacionamento com a Alpha" descricao="CS&NPS, contratos e serviços" icon={BriefcaseBusiness}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Status" valor={dados.relacionamento.status.join(" • ") || null} />
          <Campo rotulo="Serviços" valor={dados.relacionamento.servicos.join(" • ") || null} />
          <Campo rotulo="Forma de pagamento" valor={dados.relacionamento.formasPagamento.join(" • ") || null} />
          <Campo rotulo="Valores de contrato" valor={dados.relacionamento.valoresContrato.length ? dados.relacionamento.valoresContrato.map(formatarMoeda).join(" • ") : null} />
          <Campo rotulo="Contratação" valor={dados.relacionamento.datasContratacao.join(" • ") || null} />
          <Campo rotulo="Êxito" valor={dados.relacionamento.datasExito.join(" • ") || null} />
          <Campo rotulo="Origem" valor={dados.relacionamento.origens.join(" • ") || null} />
        </div>
      </Secao>

      <Secao titulo="Telefones e e-mails" descricao="Contatos encontrados nas fontes consolidadas" icon={ContactRound}>
        {dados.contatos.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dados.contatos.map((contato) => (
              <li key={`${contato.tipo}-${contato.valor}-${contato.titular}`} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                {contato.tipo === "E-mail" ? <Mail size={16} className="mt-0.5 shrink-0 text-slate-400" /> : <Phone size={16} className="mt-0.5 shrink-0 text-slate-400" />}
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-slate-200">{contato.valor}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{contato.titular} · {contato.fonte}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <EstadoVazio texto="Nenhum telefone ou e-mail informado." />}
      </Secao>

      <Secao titulo="Responsáveis pelo processo" descricao="Equipe Alpha e responsável da empresa" icon={Users}>
        {dados.responsaveis.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dados.responsaveis.map((responsavel) => (
              <li key={`${responsavel.nome}-${responsavel.papel}-${responsavel.fonte}`} className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <p className="text-sm font-bold text-slate-200">{responsavel.nome}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{responsavel.papel} · {responsavel.fonte}</p>
                {responsavel.telefone && <p className="mt-2 text-xs text-slate-400">{responsavel.telefone}</p>}
              </li>
            ))}
          </ul>
        ) : <EstadoVazio texto="Nenhum responsável informado." />}
      </Secao>

      <Secao titulo="Sócios e pessoas vinculadas" descricao="QSA do cartão CNPJ e contatos do CS&NPS/BPM" icon={Landmark}>
        {dados.pessoas.length ? (
          <ul className="space-y-2">
            {dados.pessoas.map((pessoa) => (
              <li key={pessoa.nome} className="grid gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-bold text-slate-100">{pessoa.nome}</p>
                  <p className="mt-1 text-xs text-slate-500">{pessoa.funcao || "Vínculo não informado"}</p>
                  {pessoa.observacoes && <p className="mt-2 text-xs leading-relaxed text-slate-400">{pessoa.observacoes}</p>}
                </div>
                <div className="text-left text-xs text-slate-400 sm:text-right">
                  <p>{pessoa.telefone || "Sem telefone"}</p>
                  <p className="mt-1">{pessoa.email || "Sem e-mail"}</p>
                  <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-600">{pessoa.fontes.join(" + ")}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <EstadoVazio texto="Nenhum sócio ou pessoa vinculada informado." />}
      </Secao>

      <Secao titulo="CNAEs" descricao="Atividade principal e atividades secundárias" icon={FileBadge}>
        {dados.cnaes.length ? (
          <ul className="space-y-2">
            {dados.cnaes.map((cnae) => (
              <li key={`${cnae.tipo}-${cnae.codigo}-${cnae.descricao}`} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <span className="shrink-0 font-mono text-xs font-bold" style={{ color: `rgb(${accent})` }}>{cnae.codigo}</span>
                <div>
                  <p className="text-xs leading-relaxed text-slate-300">{cnae.descricao}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">{cnae.tipo}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <EstadoVazio texto="Nenhum CNAE informado." />}
      </Secao>

      <Secao titulo="Regime tributário" descricao="Receita Federal e histórico fiscal" icon={BarChart3}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Regime atual" valor={dados.regimeTributario.atual} />
          <Campo rotulo="Regime Receita" valor={dados.regimeTributario.receita} />
          <Campo rotulo="Simples Nacional" valor={<SimNao valor={dados.regimeTributario.simplesNacional} />} />
          <Campo rotulo="MEI" valor={<SimNao valor={dados.regimeTributario.mei} />} />
          <Campo rotulo="Opção pelo Simples" valor={dados.regimeTributario.dataOpcaoSimples} />
          <Campo rotulo="Exclusão do Simples" valor={dados.regimeTributario.dataExclusaoSimples} />
        </div>
        {dados.regimeTributario.historico.length > 0 && (
          <div className="mt-3 space-y-2">
            {dados.regimeTributario.historico.map((item, index) => (
              <div key={`${item.periodo}-${item.regime}-${index}`} className="flex justify-between gap-4 rounded-xl bg-black/20 px-4 py-2 text-xs">
                <span className="font-mono text-slate-500">{item.periodo}</span><span className="text-right font-semibold text-slate-300">{item.regime}</span>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao titulo="Dados do RADAR" descricao="Habilitação e qualificação fiscal" icon={ShieldCheck}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Situação" valor={dados.radar.situacao || "Não consultado"} />
          <Campo rotulo="Submodalidade" valor={dados.radar.submodalidade || "Não consultado"} />
          <Campo rotulo="Qualificação" valor={dados.radar.qualificacao} />
          <Campo rotulo="PERSE / Anexo" valor={[dados.radar.perse, dados.radar.anexoPerse].filter(Boolean).join(" • ") || null} />
          <Campo rotulo="Dívida tributária" valor={formatarMoeda(dados.radar.dividaTributaria)} />
          <Campo rotulo="Consultado em" valor={dados.radar.consultadoEm} />
        </div>
      </Secao>

      <footer className="flex flex-wrap items-center gap-4 px-2 py-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5"><MapPin size={12} /> {localidade || "Localidade não informada"}</span>
        <span className="flex items-center gap-1.5"><CalendarDays size={12} /> Atualização: {dados.atualizadoEm || "não informada"}</span>
        <span className="flex items-center gap-1.5"><BadgeDollarSign size={12} /> {dados.relacionamento.valoresContrato.length} contrato(s) com valor informado</span>
      </footer>
    </div>
  );
}
