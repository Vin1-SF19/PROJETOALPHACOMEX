import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), permissoes: vi.fn() }));
vi.mock('../../auth', () => ({ auth: mocks.auth }));
vi.mock('@/actions/PermissoesSetor', () => ({ getPermissoesEfetivas: mocks.permissoes }));
import { acessoCatcher } from '@/lib/alpha-catcher/access';
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: '4', role: 'User', tema_interface: 'blue' } }); mocks.permissoes.mockResolvedValue([]); });
describe('permissão Alpha Catcher', () => {
  it('exige sessão', async () => { mocks.auth.mockResolvedValue(null); expect((await acessoCatcher()).status).toBe(401); });
  it('não concede acesso por possuir apenas Leads ou Radar', async () => {
    mocks.permissoes.mockResolvedValue(['leads', 'radar']); expect((await acessoCatcher()).status).toBe(403);
  });
  it('aceita permissão efetiva própria', async () => {
    mocks.permissoes.mockResolvedValue(['alphaCatcher']); expect((await acessoCatcher()).status).toBe(200);
  });
  it('aceita bypass administrativo do projeto', async () => {
    mocks.auth.mockResolvedValue({ user: { id: '4', role: 'TI' } }); expect((await acessoCatcher()).status).toBe(200);
  });
  it('rejeita identidade inválida', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'invalid', role: 'TI' } }); expect((await acessoCatcher()).status).toBe(403);
  });
});
