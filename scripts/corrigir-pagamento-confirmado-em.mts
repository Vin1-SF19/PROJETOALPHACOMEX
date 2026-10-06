/** Correção pontual autorizada: atualiza apenas pagamentoConfirmadoEm do contrato GISELLE. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
Object.assign(process.env, { NODE_ENV: 'production' });
const { default: db } = await import('../src/lib/prisma');

const id = 'cmuh4n69p00000agm844kax9s';
const atual = new Date('2026-10-01T00:00:00.000Z');
const novo = new Date('2026-09-30T00:00:00.000Z');

try {
    const atualRegistro = await db.contratoComercial.findUnique({
        where: { id },
        select: { id: true, status: true, contaComVenda: true, pagamentoConfirmadoEm: true, mes: true, ano: true, updatedAt: true },
    });
    if (!atualRegistro) {
        console.error('Contrato não encontrado. Nenhuma escrita realizada.');
        process.exitCode = 1;
    } else if (atualRegistro.pagamentoConfirmadoEm?.toISOString() !== atual.toISOString()) {
        console.error('Valor atual de pagamentoConfirmadoEm diverge do esperado. Nenhuma escrita realizada.');
        console.error(JSON.stringify({ esperado: atual.toISOString(), atual: atualRegistro.pagamentoConfirmadoEm?.toISOString() ?? null }, null, 2));
        process.exitCode = 1;
    } else if (atualRegistro.status !== 'FECHADO' || atualRegistro.contaComVenda !== true) {
        console.error('Contrato não está FECHADO + contaComVenda. Nenhuma escrita realizada.');
        console.error(JSON.stringify({ status: atualRegistro.status, contaComVenda: atualRegistro.contaComVenda }, null, 2));
        process.exitCode = 1;
    } else {

    const antes = { ...atualRegistro };
    const atualizado = await db.$transaction(async (tx) => {
        const rows = await tx.$executeRaw`
            UPDATE "contratos_comerciais"
            SET "pagamentoConfirmadoEm" = ${novo}
            WHERE "id" = ${id}
              AND "pagamentoConfirmadoEm" = ${atual}
        `;
        if (rows !== 1) {
            throw new Error('Nenhum registro atualizado pela guarda de valor atual.');
        }
        return tx.contratoComercial.findUnique({
            where: { id },
            select: { id: true, status: true, contaComVenda: true, pagamentoConfirmadoEm: true, mes: true, ano: true, updatedAt: true },
        });
    });
    if (!atualizado) {
        throw new Error('Contrato não encontrado após update.');
    }

    console.log(JSON.stringify({
        ok: true,
        id,
        antes,
        depois: atualizado,
        pagamentoConfirmadoEm: atualizado.pagamentoConfirmadoEm?.toISOString() ?? null,
        mes: atualizado.mes,
        ano: atualizado.ano,
        status: atualizado.status,
        contaComVenda: atualizado.contaComVenda,
    }, null, 2));
    }
} catch (err) {
    console.error('Correção não realizada com segurança:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
} finally {
    await db.$disconnect();
}
