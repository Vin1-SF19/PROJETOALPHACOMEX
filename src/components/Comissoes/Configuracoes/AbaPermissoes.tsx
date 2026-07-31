"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DefinirPermissao,
  ListarUsuariosComPermissoes,
  RestaurarPermissoesPadrao,
  type UsuarioComPermissoesRow,
} from "@/actions/CommissionPermissions";
import { CATEGORIA_LABEL, CATEGORIAS_PERMISSAO, type CategoriaPermissao } from "@/lib/commissions/permissions";

/**
 * RBAC granular por categoria — só para usuários FINANCEIRO (Admin/CEO sempre têm acesso
 * total, não aparecem aqui). Usuário sem nenhuma configuração explícita aparece com tudo
 * marcado (fallback aberto — decisão do usuário, para não quebrar quem já usa o módulo).
 */
export function AbaPermissoes() {
  const [usuarios, setUsuarios] = useState<UsuarioComPermissoesRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarUsuariosComPermissoes();
    if (resultado.success) {
      setUsuarios(resultado.data);
      setErro(null);
    } else {
      setErro(resultado.error);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function alternar(userId: number, categoria: CategoriaPermissao, valorAtual: boolean) {
    startTransition(async () => {
      const resultado = await DefinirPermissao({ userId, categoria, permitido: !valorAtual });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao atualizar permissão");
        return;
      }
      void carregar();
    });
  }

  function restaurar(userId: number) {
    startTransition(async () => {
      const resultado = await RestaurarPermissoesPadrao({ userId });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao restaurar permissões");
        return;
      }
      toast.success("Permissões restauradas para o padrão.");
      void carregar();
    });
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
        Não foi possível carregar as permissões. <code className="text-xs">{erro}</code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Controle por categoria de ação para usuários com role FINANCEIRO. Admin/CEO sempre têm
        acesso total e não precisam de configuração aqui. Usuário sem nenhuma marcação abaixo
        mantém acesso total (padrão).
      </p>

      {usuarios.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum usuário com role FINANCEIRO cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{usuario.nome}</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-slate-300" disabled={isPending}>
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Restaurar padrão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Restaurar permissões de {usuario.nome}?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        As personalizações serão removidas e o usuário voltará ao padrão do módulo, com todas as categorias permitidas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => restaurar(usuario.id)}>Restaurar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CATEGORIAS_PERMISSAO.map((categoria) => (
                  <label
                    key={categoria}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/5 bg-slate-950/40 p-2 text-xs text-slate-300"
                  >
                    <Checkbox
                      checked={usuario.permissoes[categoria]}
                      disabled={isPending}
                      onCheckedChange={() => alternar(usuario.id, categoria, usuario.permissoes[categoria])}
                    />
                    {CATEGORIA_LABEL[categoria]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
