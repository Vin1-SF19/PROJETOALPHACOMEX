/** Auditoria somente leitura; mes/ano são da criação, não prova da data escolhida. */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
Object.assign(process.env, { NODE_ENV: 'production' });
const { default: db } = await import('../src/lib/prisma');
try {
    const contratos = await db.contratoComercial.findMany({
        where: { status: 'FECHADO', contaComVenda: true },
        select: { id: true, pagamentoConfirmadoEm: true, mes: true, ano: true },
    });
    const candidatos = contratos.filter((c) => !c.pagamentoConfirmadoEm
        || c.pagamentoConfirmadoEm.getUTCHours() !== 0
        || c.pagamentoConfirmadoEm.getUTCMinutes() !== 0
        || c.pagamentoConfirmadoEm.getUTCSeconds() !== 0
        || c.pagamentoConfirmadoEm.getUTCMilliseconds() !== 0
        || c.pagamentoConfirmadoEm.getUTCMonth() + 1 !== c.mes
        || c.pagamentoConfirmadoEm.getUTCFullYear() !== c.ano);
    console.log(JSON.stringify({ total: contratos.length, candidatos, casoInformado: contratos.find((c) => c.id === 'cmuh4n69p00000agm844kax9s') ?? null, aviso: 'Divergência não comprova erro. Validar data original no comprovante de fechamento antes de qualquer correção. Nenhuma escrita.' }, null, 2));
} catch {
    console.error('Auditoria indisponível: não foi possível consultar os contratos. Nenhum dado alterado.');
    process.exitCode = 1;
} finally {
    await db.$disconnect();
}
