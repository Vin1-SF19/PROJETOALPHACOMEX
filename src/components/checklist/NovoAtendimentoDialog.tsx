"use client";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { buscarClienteParaVincularOperacional, listarContasPortalChecklist } from "@/actions/ClientesOperacional";
import { criarAtendimentoChecklist } from "@/actions/checklist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Acao, Falha, campoChecklist, Paginas } from "./ChecklistUI";
import { useChecklistCommand } from "./useChecklistCommand";
import { confirmar, erroChecklist, type Analista, type Dados } from "@/lib/checklist/client/types";
const schema = z
  .object({ cnpj: z.string().min(11, "Informe o CNPJ."), nome: z.string(), email: z.string(), conta: z.string(), analista: z.string() })
  .superRefine((v, c) => {
    if (v.conta === "NOVA") {
      if (v.nome.trim().length < 2) c.addIssue({ code: "custom", path: ["nome"], message: "Informe o nome." });
      if (!z.string().email().safeParse(v.email).success) c.addIssue({ code: "custom", path: ["email"], message: "Informe um e-mail válido." });
    }
  });
type Form = z.infer<typeof schema>;
type Master = Dados<Awaited<ReturnType<typeof buscarClienteParaVincularOperacional>>>;
interface Props {
  onClose: () => void;
  analistas: Analista[];
  canAssign: boolean;
  onCreated: () => void;
}
export function NovoAtendimentoDialog({ onClose, analistas, canAssign, onCreated }: Props) {
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { cnpj: "", nome: "", email: "", conta: "NOVA", analista: "" } });
  const [master, setMaster] = useState<Master | null>(null),
    [consultando, setConsultando] = useState(false),
    [erro, setErro] = useState(""),
    [resultado, setResultado] = useState<{ senha?: string; replayed: boolean } | null>(null),
    [contaBusca, setContaBusca] = useState(""),
    [contaPage, setContaPage] = useState(1);
  const consulta = useRef(0),
    command = useChecklistCommand();
  const cnpjField = form.register("cnpj");
  const contaSelecionada = useWatch({ control: form.control, name: "conta" });
  const contas = useQuery({
    queryKey: ["checklist-contas", contaBusca, contaPage],
    queryFn: () => confirmar(listarContasPortalChecklist({ busca: contaBusca || undefined, page: contaPage, pageSize: 15 })),
  });
  async function consultar() {
    const id = ++consulta.current,
      cnpj = form.getValues("cnpj");
    setConsultando(true);
    setErro("");
    setMaster(null);
    try {
      const data = await confirmar(buscarClienteParaVincularOperacional(cnpj));
      if (id === consulta.current && form.getValues("cnpj") === cnpj) setMaster(data);
    } catch (e) {
      if (id === consulta.current) setErro(erroChecklist(e));
    } finally {
      if (id === consulta.current) setConsultando(false);
    }
  }
  async function salvar(values: Form) {
    if (!master) {
      setErro("Consulte e confirme a empresa antes de salvar.");
      return;
    }
    const input = {
      clienteId: master.id,
      ...(values.conta === "NOVA" ? { novaConta: { nome: values.nome, email: values.email } } : { clienteOperacionalId: values.conta }),
      ...(canAssign && values.analista ? { analistaId: Number(values.analista) } : {}),
    };
    const data = await command.run(JSON.stringify(input), (mutationId) => criarAtendimentoChecklist({ ...input, mutationId }));
    if (data) {
      setResultado({ senha: data.credencialInicial, replayed: data.replayed });
      onCreated();
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/15 bg-slate-950 text-slate-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>Vincule uma empresa do CRM e defina o acesso ao portal. O cadastro empresarial permanece no CRM.</DialogDescription>
        </DialogHeader>
        {resultado ? (
          <div className="space-y-4">
            <p role="status" className="text-emerald-300">
              Atendimento confirmado.
            </p>
            {resultado.senha ? (
              <>
                <p className="text-sm text-slate-400">Entregue esta senha inicial ao cliente. Ela é exibida somente nesta resposta.</p>
                <output className="block select-all break-all rounded-xl border border-white/10 p-4 font-mono">{resultado.senha}</output>
                <Acao onClick={() => void navigator.clipboard.writeText(resultado.senha ?? "")}>Copiar senha inicial</Acao>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {resultado.replayed
                  ? "Solicitação já confirmada. A credencial não é exibida novamente; use a emissão de reset se necessário."
                  : "Foi utilizada uma conta existente."}
              </p>
            )}
            <Acao onClick={onClose}>Concluir</Acao>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              void form.handleSubmit(salvar)(event);
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              CNPJ
              <div className="mt-1 flex gap-2">
                <input
                  {...cnpjField}
                  onChange={(event) => {
                    void cnpjField.onChange(event);
                    consulta.current++;
                    setMaster(null);
                    setConsultando(false);
                  }}
                  className={campoChecklist}
                />
                <Acao type="button" disabled={consultando || command.busy} onClick={() => void consultar()}>
                  {consultando ? "Consultando…" : "Consultar"}
                </Acao>
              </div>
            </label>
            {master && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/30 p-4 text-sm">
                <p className="font-semibold">{master.razaoSocial}</p>
                <p className="mt-1 text-slate-400">{master.cnpj}</p>
                <p className="mt-2 text-xs text-emerald-300">Empresa confirmada no CRM</p>
              </div>
            )}
            <label className="block text-sm">
              Acesso ao portal
              <select {...form.register("conta")} className={campoChecklist + " mt-1"}>
                <option value="NOVA">Criar novo acesso</option>
                {contas.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Buscar conta existente
              <input
                value={contaBusca}
                onChange={(e) => {
                  setContaBusca(e.target.value);
                  setContaPage(1);
                }}
                className={campoChecklist + " mt-1"}
              />
            </label>
            {contas.isError && <Falha error={contas.error} retry={() => void contas.refetch()} />}
            {contas.data && contas.data.totalCount > 15 && <Paginas page={contaPage} pageSize={15} total={contas.data.totalCount} onPage={setContaPage} />}
            {contaSelecionada === "NOVA" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Nome do cliente
                  <input {...form.register("nome")} className={campoChecklist + " mt-1"} />
                </label>
                <label className="text-sm">
                  E-mail de acesso
                  <input type="email" {...form.register("email")} className={campoChecklist + " mt-1"} />
                </label>
              </div>
            )}
            {canAssign && (
              <label className="block text-sm">
                Analista responsável
                <select {...form.register("analista")} required className={campoChecklist + " mt-1"}>
                  <option value="">Selecione o analista</option>
                  {analistas
                    .filter((a) => a.ativo && !a.legado)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {Object.values(form.formState.errors).map((e, i) => (
              <p key={i} role="alert" className="text-sm text-rose-300">
                {e.message}
              </p>
            ))}
            {(erro || command.error) && <Falha error={erro || command.error} />}
            <Acao type="submit" disabled={!master || command.busy} className="w-full bg-[var(--checklist-accent)]">
              {command.busy ? "Salvando…" : "Confirmar atendimento"}
            </Acao>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
