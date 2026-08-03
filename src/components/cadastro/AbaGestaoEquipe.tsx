'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Search, Pencil, Trash2, Building2, UserCog, Activity, AlertTriangle, BookCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getUsers } from '@/actions/get-user';
import { deleteUser } from '@/actions/manage-user';
import DeleteUserDialog from '@/components/DeleteUserDialog';
import ModalGerenciarSetor from './ModalGerenciarSetor';
import ModalOverrideUser from './ModalOverrideUser';
import ModalPerfilColaborador from '@/components/Colaboradores/ModalPerfilColaborador';
import { getContratosVencendo } from '@/actions/ColaboradorRH';
import { buscarStatusLeituraEquipe, type StatusLeituraUsuario } from '@/actions/ConfirmacaoLeituraDocumento';
import { isAdminRole } from '@/lib/roles';

interface UserItem {
  id: number;
  nome: string;
  usuario: string;
  email: string;
  role: string;
  imagemUrl?: string | null;
  status?: string;
}

interface AbaGestaoEquipeProps {
  currentUserRole?: string;
}

export default function AbaGestaoEquipe({ currentUserRole = 'User' }: AbaGestaoEquipeProps) {
  const isAdmin = isAdminRole(currentUserRole);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [setorFiltro, setSetorFiltro] = useState('');

  const [perfilUserId, setPerfilUserId] = useState<number | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [setorModalOpen, setSetorModalOpen] = useState(false);
  const [overrideUser, setOverrideUser] = useState<UserItem | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  // Alertas contratos vencendo
  const [contratosVencendo, setContratosVencendo] = useState<{ id: string; dataFim: Date | null; usuario: { nome: string } }[]>([]);

  // Status de leitura de documentos do POP (Regimento Interno + docs do setor)
  const [statusLeitura, setStatusLeitura] = useState<Record<number, StatusLeituraUsuario>>({});

  async function load() {
    setLoading(true);
    const data = await getUsers();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function loadAlertas() {
    const res = await getContratosVencendo();
    if (res.success) setContratosVencendo(res.contratos as typeof contratosVencendo);
  }

  async function loadStatusLeitura() {
    const res = await buscarStatusLeituraEquipe();
    if (res.success) setStatusLeitura(res.data);
  }

  useEffect(() => {
    void load();
    void loadAlertas();
    void loadStatusLeitura();
  }, []);

  async function handleDelete() {
    if (!deleteId) return;
    const r = await deleteUser(deleteId);
    if (r.success) { toast.success('Usuário removido'); void load(); }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  const setores = [...new Set(users.map(u => u.role))].sort();
  const totalUsers: Record<string, number> = {};
  for (const u of users) totalUsers[u.role] = (totalUsers[u.role] ?? 0) + 1;

  const filtered = users.filter(u => {
    const matchSearch = (u.nome || u.usuario || '').toLowerCase().includes(search.toLowerCase());
    const matchSetor = !setorFiltro || u.role === setorFiltro;
    return matchSearch && matchSetor;
  });

  const initials = (nome: string) => nome?.substring(0, 2).toUpperCase() || 'U';

  const diasAte = (date: Date | null) => {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  };

  return (
    <div className="space-y-6">

      {/* Alertas contratos vencendo */}
      {contratosVencendo.length > 0 && (
        <div className="flex flex-col gap-2">
          {contratosVencendo.map(c => {
            const dias = diasAte(c.dataFim);
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/25">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                  Contrato de <span className="text-white">{c.usuario.nome}</span> vence em{' '}
                  <span className="text-amber-300">{dias !== null ? `${dias} dias` : '—'}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-black/40 border border-white/10 text-[11px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 outline-none"
            />
          </div>
          <select
            value={setorFiltro}
            onChange={e => setSetorFiltro(e.target.value)}
            className="h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-[11px] font-bold text-white focus:border-indigo-500/40 outline-none"
            style={{ backgroundColor: '#0f172a', color: 'white' }}
          >
            <option value="" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>Todos os setores</option>
            {setores.map(s => <option key={s} value={s} style={{ backgroundColor: '#0f172a', color: 'white' }}>{s}</option>)}
          </select>
        </div>

        {isAdmin && (
          <button
            onClick={() => setSetorModalOpen(true)}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shrink-0"
          >
            <Building2 size={14} />
            Gerenciar Setores
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">
        <span>{users.length} colaboradores</span>
        <span>·</span>
        <span>{filtered.length} exibidos</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-20">
          <Activity className="animate-pulse text-indigo-500" size={40} />
          <span className="text-xs font-black uppercase tracking-widest">Carregando equipe...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-xs font-black uppercase tracking-widest">
          Nenhum colaborador encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((user, i) => {
            const vencendo = contratosVencendo.some(c => c.usuario.nome === user.nome);
            const leitura = statusLeitura[user.id];
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-white/5 bg-black/40 hover:bg-slate-900/60 hover:border-indigo-500/20 transition-all duration-300 overflow-hidden"
              >
                {vencendo && (
                  <div className="absolute top-3 right-3">
                    <AlertTriangle size={12} className="text-amber-400" />
                  </div>
                )}

                {leitura && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${
                      leitura.regimentoInternoLido
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      <BookCheck size={9} /> Regimento Interno
                    </span>
                    {leitura.totalDocumentosSetor > 0 && (
                      leitura.todosDocumentosSetorLidos ? (
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                          Todos os documentos do setor lido
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border bg-amber-500/10 border-amber-500/20 text-amber-400">
                          {leitura.documentosLidosSetor}/{leitura.totalDocumentosSetor} docs do setor lidos
                        </span>
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="shrink-0 h-11 w-11 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                    {user.imagemUrl ? (
                      <Image src={user.imagemUrl} alt={user.nome} width={44} height={44} unoptimized className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-indigo-400 font-black text-xs">{initials(user.nome)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white uppercase truncate italic">{user.nome || user.usuario}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                        {user.role}
                      </span>
                      {user.status && user.status !== 'ATIVO' && (
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase border bg-red-500/10 border-red-500/20 text-red-400">
                          {user.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[9px] text-slate-600 truncate lowercase">{user.email}</p>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  {/* Permissões — Admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => { setOverrideUser(user); setOverrideOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl bg-white/5 border border-white/5 text-[8px] font-black uppercase text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all cursor-pointer"
                    >
                      <UserCog size={11} />
                      Permissões
                    </button>
                  )}

                  {/* Editar — todos (Admin, RH, Financeiro) */}
                  <button
                    onClick={() => { setPerfilUserId(user.id); setPerfilOpen(true); }}
                    className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-blue-400 hover:border-blue-500/30 transition-all cursor-pointer"
                    title="Editar perfil completo"
                  >
                    <Pencil size={13} />
                  </button>

                  {/* Excluir — Admin only */}
                  {isAdmin && (
                    <button
                      onClick={() => { setDeleteId(String(user.id)); setDeleteOpen(true); }}
                      className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ModalPerfilColaborador
        usuarioId={perfilUserId}
        currentUserRole={currentUserRole}
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        onAtualizado={() => void load()}
      />

      {isAdmin && (
        <>
          <ModalGerenciarSetor open={setorModalOpen} onClose={() => setSetorModalOpen(false)} totalUsers={totalUsers} />
          <ModalOverrideUser
            user={overrideUser ? { id: overrideUser.id, nome: overrideUser.nome, role: overrideUser.role } : null}
            open={overrideOpen}
            onClose={() => setOverrideOpen(false)}
          />
        </>
      )}

      <DeleteUserDialog open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={() => void handleDelete()} />
    </div>
  );
}
