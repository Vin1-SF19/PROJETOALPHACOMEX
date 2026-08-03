"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Check, ImagePlus, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AplicarTema, CriarTema } from "@/actions/apresentacao-temas";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import type { TemaResumo } from "../ApresentacaoEditor";

const brandKitSchema = z.object({
  nome: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(100),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  corSecundaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  corAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  fontePrimaria: z.string().min(1),
  fonteSecundaria: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

type BrandKitForm = z.infer<typeof brandKitSchema>;

interface BrandKitPanelProps {
  apresentacaoId: string;
  assets: AssetApresentacao[];
  temaAtual: TemaResumo | null;
  onTemaAplicado: (tema: TemaResumo) => void;
  onInsertLogo: (asset: AssetApresentacao) => void;
}

const FONTES = ["Inter", "Arial", "Georgia", "Helvetica", "Montserrat", "Poppins", "Roboto", "Times New Roman"];

export function BrandKitPanel({ apresentacaoId, assets, temaAtual, onTemaAplicado, onInsertLogo }: BrandKitPanelProps) {
  const imagens = assets.filter((asset) => asset.tipo === "IMAGEM");
  const [salvando, setSalvando] = useState(false);
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<BrandKitForm>({
    resolver: zodResolver(brandKitSchema),
    defaultValues: {
      nome: temaAtual?.nome ? `${temaAtual.nome} — Marca` : "Marca Alpha",
      corPrimaria: temaAtual?.corPrimaria ?? "#071a3d",
      corSecundaria: temaAtual?.corSecundaria ?? "#0f172a",
      corAccent: temaAtual?.corAccent ?? "#4f46e5",
      fontePrimaria: "Inter",
      fonteSecundaria: "Georgia",
      logoUrl: "",
    },
  });
  const valores = useWatch({ control });
  const logoSelecionada = imagens.find((asset) => asset.url === valores.logoUrl);

  async function salvarMarca(dados: BrandKitForm) {
    setSalvando(true);
    try {
      const criacao = await CriarTema({
        nome: dados.nome,
        corPrimaria: dados.corPrimaria,
        corSecundaria: dados.corSecundaria,
        corAccent: dados.corAccent,
        fontePrimaria: dados.fontePrimaria,
        fonteSecundaria: dados.fonteSecundaria,
        radius: "16px",
        tokensJson: { logoUrl: dados.logoUrl || null, origem: "central-criativa" },
      });
      if (!criacao.success || !criacao.data) {
        toast.error(typeof criacao.error === "string" ? criacao.error : "Não foi possível criar a marca.");
        return;
      }
      const aplicacao = await AplicarTema({ apresentacaoId, temaId: criacao.data.id });
      if (!aplicacao.success) {
        toast.error(typeof aplicacao.error === "string" ? aplicacao.error : "Marca criada, mas não foi possível aplicá-la.");
        return;
      }
      onTemaAplicado({
        id: criacao.data.id,
        nome: dados.nome,
        corPrimaria: dados.corPrimaria,
        corSecundaria: dados.corSecundaria,
        corAccent: dados.corAccent,
      });
      toast.success("Brand Kit criado e aplicado à apresentação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(salvarMarca)} className="grid h-full min-h-0 gap-5 overflow-y-auto pr-1 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <div><h3 className="text-sm font-semibold text-white">Identidade da marca</h3><p className="mt-1 text-xs text-slate-500">Salva um tema próprio e o aplica imediatamente.</p></div>
          <label className="block space-y-1.5 text-xs text-slate-400">Nome do Brand Kit
            <input {...register("nome")} aria-invalid={Boolean(errors.nome)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
            {errors.nome && <span className="text-[11px] text-red-400">{errors.nome.message}</span>}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["corPrimaria", "corSecundaria", "corAccent"] as const).map((campo, index) => (
              <label key={campo} className="space-y-1.5 text-xs text-slate-400">{["Primária", "Secundária", "Destaque"][index]}
                <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 p-2"><input type="color" {...register(campo)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /><input {...register(campo)} aria-label={`Cor ${campo}`} className="min-w-0 flex-1 bg-transparent text-xs uppercase text-white outline-none" /></span>
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">Fonte de títulos<select {...register("fontePrimaria")} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none">{FONTES.map((fonte) => <option key={fonte}>{fonte}</option>)}</select></label>
            <label className="space-y-1.5 text-xs text-slate-400">Fonte de textos<select {...register("fonteSecundaria")} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none">{FONTES.map((fonte) => <option key={fonte}>{fonte}</option>)}</select></label>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <div><h3 className="text-sm font-semibold text-white">Logo</h3><p className="mt-1 text-xs text-slate-500">Escolha uma imagem já enviada à biblioteca.</p></div>
          {imagens.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Envie uma imagem na aba Biblioteca para usá-la como logo.</div> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {imagens.map((asset) => <button key={asset.id} type="button" onClick={() => setValue("logoUrl", asset.url, { shouldValidate: true })} aria-label={`Usar ${asset.nomeOriginal} como logo`} className={`relative aspect-square overflow-hidden rounded-xl border bg-slate-950 ${valores.logoUrl === asset.url ? "border-indigo-400 ring-2 ring-indigo-500/20" : "border-white/10 hover:border-white/30"}`}><Image src={asset.url} alt="" fill unoptimized sizes="100px" className="object-contain p-2" />{valores.logoUrl === asset.url && <span className="absolute right-1 top-1 rounded-full bg-indigo-500 p-1 text-white"><Check size={10} /></span>}</button>)}
            </div>
          )}
          {logoSelecionada && <button type="button" onClick={() => onInsertLogo(logoSelecionada)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"><ImagePlus size={14} /> Inserir logo no slide</button>}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
          <div className="flex h-28 items-center justify-center p-5" style={{ backgroundColor: valores.corPrimaria }}>{logoSelecionada ? <Image src={logoSelecionada.url} alt="Prévia da logo" width={160} height={70} unoptimized className="max-h-16 w-auto object-contain" /> : <Palette size={34} style={{ color: valores.corAccent }} />}</div>
          <div className="space-y-2 p-4" style={{ backgroundColor: valores.corSecundaria }}><p className="text-lg font-bold" style={{ color: valores.corAccent, fontFamily: valores.fontePrimaria }}>{valores.nome || "Sua marca"}</p><p className="text-xs text-white/70" style={{ fontFamily: valores.fonteSecundaria }}>Cores, tipografia e logo consistentes em toda apresentação.</p></div>
        </div>
        <button type="submit" disabled={salvando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />} {salvando ? "Salvando..." : "Criar e aplicar Brand Kit"}</button>
      </aside>
    </form>
  );
}
