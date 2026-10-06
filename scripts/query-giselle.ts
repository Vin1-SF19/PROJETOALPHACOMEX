import db from '@/lib/prisma'

async function main() {
  const mes = 9
  const ano = 2026
  const inicio = new Date(Date.UTC(ano, mes - 1, 1))
  const fim = new Date(Date.UTC(ano, mes, 1))

  const giselle = await db.contratoComercial.findMany({
    where: { closerNome: { contains: 'GISELLE' } },
    include: { cliente: { select: { cnpj: true, razaoSocial: true, nomeFantasia: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const campos = (c: (typeof giselle)[number]) => ({
    id: c.id,
    status: c.status,
    servico: c.servico,
    valorContrato: c.valorContrato,
    contaComVenda: c.contaComVenda,
    pagamentoConfirmado: c.pagamentoConfirmado,
    pagamentoConfirmadoEm: c.pagamentoConfirmadoEm,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    mes: c.mes,
    ano: c.ano,
    closerNome: c.closerNome,
    cliente: c.cliente,
    contaNoMes:
      c.status === 'FECHADO' &&
      c.contaComVenda === true &&
      c.pagamentoConfirmadoEm !== null &&
      c.pagamentoConfirmadoEm >= inicio &&
      c.pagamentoConfirmadoEm < fim,
  })

  const filtro = {
    mes,
    ano,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    giselleCount: giselle.filter((c) => campos(c).contaNoMes).length,
  }

  console.log(JSON.stringify({ filtro, giselle: giselle.map(campos) }, null, 2))
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
