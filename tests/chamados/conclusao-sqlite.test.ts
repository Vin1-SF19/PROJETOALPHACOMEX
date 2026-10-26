import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));
import { concluirChamadoComFeedback } from "@/lib/chamados/conclusao";
import { erroSqliteBusy } from "@/lib/bpm/sqlite-busy-retry";

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(): unknown; all(): unknown[] };
  close(): void;
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => SqliteDatabase;
};

const dados = {
  chamadoId: 10, tecnicoId: 3, concluidoEm: new Date("2026-10-26T12:00:00Z"),
  solucao: "Acesso restabelecido", causa: "Permissão", mensagemFinal: "Resolvido", templateId: 1,
};

describe("conclusão com Prisma/libSQL e SQLite descartável", () => {
  let directory: string;
  let sqlite: SqliteDatabase;
  let prisma: PrismaClient;
  let filename: string;
  let bloqueador: ChildProcess | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "chamados-conclusao-"));
    filename = join(directory, "test.db");
    sqlite = new DatabaseSync(filename);
    sqlite.exec(`PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE usuarios(id INTEGER PRIMARY KEY, nome TEXT, role TEXT, status TEXT);
      CREATE TABLE setor(id INTEGER PRIMARY KEY, nome TEXT, ativo BOOLEAN, isBase BOOLEAN);
      CREATE TABLE protocolo_template(id INTEGER PRIMARY KEY);
      CREATE TABLE chamados(
        id INTEGER PRIMARY KEY, titulo TEXT, usuarioId INTEGER REFERENCES usuarios(id),
        tecnicoId INTEGER REFERENCES usuarios(id), status TEXT, tecnicoSolicitadoId INTEGER,
        setorDestinoId INTEGER REFERENCES setor(id), solucao TEXT, causa TEXT, mensagemFinal TEXT,
        templateId INTEGER REFERENCES protocolo_template(id), closedAt DATETIME, updatedAt DATETIME
      );
      CREATE TABLE chamados_feedback(
        chamadoId INTEGER PRIMARY KEY REFERENCES chamados(id), status TEXT NOT NULL DEFAULT 'PENDENTE',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL
      );
      INSERT INTO usuarios VALUES(3,'Técnico','TI','ATIVO'),(7,'Solicitante','COMERCIAL','ATIVO');
      INSERT INTO setor VALUES(14,'TI',1,0);
      INSERT INTO protocolo_template VALUES(1);
      INSERT INTO chamados(id,titulo,usuarioId,tecnicoId,status,setorDestinoId)
        VALUES(10,'Teste sintético',7,3,'EM_ATENDIMENTO',14);`);
    prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
    mocks.transaction.mockReset().mockImplementation((callback, options) => prisma.$transaction(callback, options));
  });

  afterEach(async () => {
    if (bloqueador && bloqueador.exitCode === null) {
      bloqueador.kill();
      await once(bloqueador, "exit");
    }
    bloqueador = undefined;
    await prisma.$disconnect();
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });

  function estado() {
    return sqlite.prepare("SELECT status,closedAt,solucao,causa,mensagemFinal,templateId FROM chamados WHERE id=10").get();
  }

  it("recupera lock real e confirma uma única conclusão com protocolo e feedback", async () => {
    let tentativas = 0;
    let bloqueioReal = false;
    mocks.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options) => {
      tentativas += 1;
      const primeira = tentativas === 1;
      try {
        return await prisma.$transaction(async (tx) => {
          if (!primeira) return callback(tx);
          // Reserva a escrita em OUTRA conexão depois das leituras do serviço.
          const txComBloqueio = new Proxy(tx, {
            get(target, property) {
              if (property !== "chamados") return Reflect.get(target, property);
              return new Proxy(target.chamados, {
                get(model, operation) {
                  if (operation !== "updateMany") return Reflect.get(model, operation);
                  return async (args: Prisma.chamadosUpdateManyArgs) => {
                    // Processo separado: locks POSIX pertencem ao processo.
                    bloqueador = spawn(process.execPath, ["--input-type=module", "-e", `
                      import { DatabaseSync } from 'node:sqlite';
                      const db = new DatabaseSync(process.argv[1]);
                      db.exec('BEGIN IMMEDIATE');
                      process.stdout.write('locked');
                      process.stdin.once('data', () => { db.exec('ROLLBACK'); db.close(); process.exit(0); });
                    `, filename], { stdio: ["pipe", "pipe", "ignore"] });
                    await once(bloqueador.stdout!, "data");
                    return tx.chamados.updateMany(args);
                  };
                },
              });
            },
          });
          return callback(txComBloqueio);
        }, options);
      } catch (error) {
        if (primeira) {
          bloqueioReal = erroSqliteBusy(error);
          const desbloqueado = once(bloqueador!, "exit");
          bloqueador!.stdin!.write("release");
          await desbloqueado;
          expect(estado()).toMatchObject({ status: "EM_ATENDIMENTO", closedAt: null, solucao: null });
          expect(sqlite.prepare("SELECT count(*) AS n FROM chamados_feedback").get()).toMatchObject({ n: 0 });
        }
        throw error;
      }
    });

    await expect(concluirChamadoComFeedback(dados)).resolves.toMatchObject({ id: 10 });
    expect(bloqueioReal).toBe(true);
    expect(tentativas).toBe(2);
    expect(estado()).toMatchObject({ status: "CONCLUIDO", solucao: dados.solucao, causa: dados.causa, mensagemFinal: dados.mensagemFinal, templateId: 1 });
    expect(sqlite.prepare("SELECT count(*) AS n FROM chamados_feedback").get()).toMatchObject({ n: 1 });
    expect(sqlite.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    await expect(concluirChamadoComFeedback(dados)).rejects.toMatchObject({ code: "STATUS_INVALIDO" });
    expect(sqlite.prepare("SELECT count(*) AS n FROM chamados_feedback").get()).toMatchObject({ n: 1 });
  });

  it("desfaz status e protocolo se a gravação do feedback falha após o update", async () => {
    sqlite.exec("CREATE TRIGGER falhar_feedback BEFORE INSERT ON chamados_feedback BEGIN SELECT RAISE(ABORT, 'feedback indisponivel'); END;");
    await expect(concluirChamadoComFeedback(dados)).rejects.toThrow();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(estado()).toMatchObject({ status: "EM_ATENDIMENTO", closedAt: null, solucao: null, causa: null, mensagemFinal: null, templateId: null });
    expect(sqlite.prepare("SELECT count(*) AS n FROM chamados_feedback").get()).toMatchObject({ n: 0 });
  });

  it("recusa uma segunda conclusão concorrente sem duplicar o feedback", async () => {
    const resultados = await Promise.allSettled([concluirChamadoComFeedback(dados), concluirChamadoComFeedback(dados)]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const falha = resultados.find((resultado) => resultado.status === "rejected");
    expect(falha).toMatchObject({ reason: { code: expect.stringMatching(/STATUS_INVALIDO|CONCORRENCIA/) } });
    expect(sqlite.prepare("SELECT count(*) AS n FROM chamados_feedback").get()).toMatchObject({ n: 1 });
    expect(estado()).toMatchObject({ status: "CONCLUIDO" });
  });
});
