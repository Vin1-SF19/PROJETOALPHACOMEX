/** Validação compartilhada por formulário e servidor, mantendo o fuso da reserva. */
export function validarIntervaloReserva(data: string, inicio: string, fim: string) {
  const horario = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !horario.test(inicio) || !horario.test(fim)) {
    return { success: false as const, error: "Informe uma data e horários válidos." };
  }
  const dia = new Date(`${data}T12:00:00-03:00`);
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) {
    return { success: false as const, error: "Informe uma data válida." };
  }
  const inicioEm = new Date(`${data}T${inicio}:00-03:00`);
  const fimEm = new Date(`${data}T${fim}:00-03:00`);
  if (fimEm.getTime() <= inicioEm.getTime()) {
    return { success: false as const, error: "O término deve ser posterior ao início da reserva." };
  }
  return { success: true as const, inicioEm, fimEm, dia: new Date(`${data}T00:00:00-03:00`) };
}
