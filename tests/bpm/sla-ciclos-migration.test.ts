import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node 24 fornece SQLite; os tipos atuais ainda não o declaram.
import { DatabaseSync } from 'node:sqlite';
const migrations = resolve('prisma/migrations');
const originalDirectory = readdirSync(migrations).find(name => name.startsWith('20260904182000'))!;
const original = readFileSync(resolve(migrations, originalDirectory, 'migration.sql'), 'utf8');
const directory = resolve(migrations, '20261014151000_sla_ciclos_etapa_abertos');
const migration = readFileSync(resolve(directory, 'migration.sql'), 'utf8');
const rollback = readFileSync(resolve(directory, 'rollback.sql'), 'utf8');
function fixture() {
  const db = new DatabaseSync(':memory:');
  // As tabelas-base de SLA eram substituídas pela migração original. Usamos seu
  // DDL real, omitindo só os DROP de tabelas ausentes no banco de teste vazio.
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec(original.replace(/^DROP TABLE .*;$/gm, ''));
  db.exec(`INSERT INTO BpmSlaConfig(id,nome,quantidade,updatedAt) VALUES('config','Etapa',1,CURRENT_TIMESTAMP)`);
  return db;
}
function insert(db: ReturnType<typeof fixture>, id: string, status: string, tarefaId: string | null = null) {
  db.prepare('INSERT INTO BpmSlaInstancia(id,cardId,tarefaId,slaConfigId,status,concluidoEm,updatedAt) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)')
    .run(id, 'card', tarefaId, 'config', status, status === 'CONCLUIDO' ? '2026-10-14T10:00:00Z' : null);
}
function alert(db: ReturnType<typeof fixture>, id: string, instance: string) {
  db.prepare('INSERT INTO BpmSlaDisparo(id,instanciaId,slaConfigId,cardId,tipoDisparo) VALUES(?,?,?,?,?)').run(id, instance, 'config', 'card', 'ALERTA_VENCIDO');
}
describe('índice real de ciclos de SLA por card', () => {
  it('reproduz falha anterior e permite reentrada preservando histórico e alertas por ciclo', () => {
    const db = fixture();
    try {
      insert(db, 'anterior', 'CONCLUIDO'); alert(db, 'alerta-anterior', 'anterior');
      expect(() => insert(db, 'novo', 'DENTRO_PRAZO')).toThrow(/UNIQUE/);
      db.exec(migration);
      insert(db, 'novo', 'DENTRO_PRAZO'); alert(db, 'alerta-novo', 'novo');
      expect(() => alert(db, 'alerta-duplicado', 'novo')).toThrow(/UNIQUE/);
      expect(() => insert(db, 'concorrente', 'DENTRO_PRAZO')).toThrow(/UNIQUE/);
      expect(() => insert(db, 'pausada-concorrente', 'PAUSADO')).toThrow(/UNIQUE/);
      expect(db.prepare('SELECT id FROM BpmSlaInstancia ORDER BY id').all()).toEqual([{ id: 'anterior' }, { id: 'novo' }]);
      expect(db.prepare('SELECT id FROM BpmSlaDisparo ORDER BY id').all()).toEqual([{ id: 'alerta-anterior' }, { id: 'alerta-novo' }]);
    } finally { db.close(); }
  });
  it('preserva a unicidade antiga de tarefas, inclusive ciclos encerrados', () => {
    const db = fixture();
    try { db.exec(migration); insert(db, 'tarefa-anterior', 'CONCLUIDO', 'tarefa'); expect(() => insert(db, 'tarefa-nova', 'DENTRO_PRAZO', 'tarefa')).toThrow(/UNIQUE/); } finally { db.close(); }
  });
  it('permite rollback antes de haver múltiplos ciclos', () => {
    const db = fixture();
    try { db.exec(migration); insert(db, 'anterior', 'CONCLUIDO'); db.exec(rollback); expect(() => insert(db, 'novo', 'DENTRO_PRAZO')).toThrow(/UNIQUE/); } finally { db.close(); }
  });
  it('bloqueia rollback após reentrada sem remover índice nem histórico', () => {
    const db = fixture();
    try {
      db.exec(migration); insert(db, 'anterior', 'CONCLUIDO'); insert(db, 'novo', 'DENTRO_PRAZO');
      expect(() => db.exec(rollback)).toThrow(/UNIQUE/); db.exec('ROLLBACK');
      expect(db.prepare('SELECT count(*) AS n FROM BpmSlaInstancia').get()).toEqual({ n: 2 });
      expect(() => insert(db, 'concorrente', 'DENTRO_PRAZO')).toThrow(/UNIQUE/);
      expect(db.prepare("SELECT sql FROM sqlite_master WHERE name='BpmSlaInstancia_card_config_key'").get().sql).toContain('concluidoEm');
    } finally { db.close(); }
  });
});
