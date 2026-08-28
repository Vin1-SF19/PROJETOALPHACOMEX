'use client';

import { useEffect, useState } from 'react';
import {
  Globe, ExternalLink, Cable, Landmark, FileText, Users, Settings,
  BarChart3, Cloud, Server, ShieldCheck, Wallet, Building2, Link2,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ROLES_CONHECIDOS } from '@/lib/validations/link-externo';
import {
  CriarLinkExterno, AtualizarLinkExterno, ExcluirLinkExterno,
  type LinkExternoVisivel,
} from '@/actions/LinksExternos';

const ICONES_DISPONIVEIS: Record<string, LucideIcon> = {
  Globe, ExternalLink, Cable, Landmark, FileText, Users, Settings,
  BarChart3, Cloud, Server, ShieldCheck, Wallet, Building2, Link2,
};

export interface LinkExternoEditavel extends LinkExternoVisivel {
  visivelPara: string;
}

interface ModalLinkExternoProps {
  open: boolean;
  onClose: () => void;
  linkEmEdicao: LinkExternoEditavel | null;
  onSalvo: (link: LinkExternoVisivel) => void;
  onExcluido: (id: string) => void;
}

export function ModalLinkExterno({ open, onClose, linkEmEdicao, onSalvo, onExcluido }: ModalLinkExternoProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [iconName, setIconName] = useState('Globe');
  const [roles, setRoles] = useState<string[]>([]);
  const [todos, setTodos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset ao abrir o modal */
    if (linkEmEdicao) {
      setLabel(linkEmEdicao.label);
      setUrl(linkEmEdicao.url);
      setIconName(linkEmEdicao.iconName);
      if (linkEmEdicao.visivelPara === 'TODOS') {
        setTodos(true);
        setRoles([]);
      } else {
        setTodos(false);
        setRoles(linkEmEdicao.visivelPara.split(',').map((r) => r.trim()));
      }
    } else {
      setLabel('');
      setUrl('');
      setIconName('Globe');
      setTodos(true);
      setRoles([]);
    }
    setErro(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, linkEmEdicao]);

  const toggleRole = (role: string) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const handleSalvar = async () => {
    setErro(null);
    if (!label.trim()) return setErro('Informe um nome.');
    if (!url.trim()) return setErro('Informe a URL.');
    if (!todos && roles.length === 0) return setErro('Selecione ao menos um setor, ou marque "Todos".');

    const visivelPara = todos ? 'TODOS' : roles.join(',');
    const input = { label: label.trim(), url: url.trim(), iconName, visivelPara };

    setSalvando(true);
    try {
      const resultado = linkEmEdicao
        ? await AtualizarLinkExterno(linkEmEdicao.id, input)
        : await CriarLinkExterno(input);

      if (!resultado.success) {
        setErro(resultado.error);
        return;
      }
      onSalvo({
        id: resultado.link.id,
        label: resultado.link.label,
        url: resultado.link.url,
        iconName: resultado.link.iconName,
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!linkEmEdicao) return;
    setExcluindo(true);
    try {
      const resultado = await ExcluirLinkExterno(linkEmEdicao.id);
      if (!resultado.success) {
        setErro(resultado.error);
        return;
      }
      onExcluido(linkEmEdicao.id);
      onClose();
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{linkEmEdicao ? 'Editar sistema externo' : 'Inserir sistema externo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="link-externo-nome" className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input
              id="link-externo-nome"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Sistema de Notas Fiscais"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="link-externo-url" className="text-xs font-medium text-muted-foreground">URL</label>
            <Input
              id="link-externo-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ícone</span>
            <div className="grid grid-cols-7 gap-2">
              {Object.entries(ICONES_DISPONIVEIS).map(([nome, Icone]) => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setIconName(nome)}
                  aria-label={nome}
                  aria-pressed={iconName === nome}
                  className={`flex items-center justify-center h-9 rounded-lg border transition-colors ${
                    iconName === nome
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icone size={16} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Visível para</span>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={todos} onCheckedChange={(v) => setTodos(v === true)} />
              Todos
            </label>
            {!todos && (
              <div className="grid grid-cols-2 gap-1.5 pl-1 pt-1">
                {ROLES_CONHECIDOS.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={roles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                    <span className="truncate">{role}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {linkEmEdicao ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={salvando || excluindo}>
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir sistema externo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{linkEmEdicao.label}&quot; será removido da sidebar de todos os usuários. Essa ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleExcluir} disabled={excluindo}>
                    {excluindo ? 'Excluindo...' : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
