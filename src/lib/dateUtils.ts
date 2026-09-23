export const deveExecutarNoDia = (tarefa: { diaSemana: number | null; intervaloDias: number | null; dataInicio: Date | string | null }, dataAlvo: Date) => {
    const alvo = new Date(dataAlvo);
    alvo.setHours(0, 0, 0, 0);

    if (tarefa.diaSemana !== null && !tarefa.intervaloDias) {
        const diaSemanaCorrigido = alvo.getDay() === 0 ? 6 : alvo.getDay() - 1;
        return Number(tarefa.diaSemana) === diaSemanaCorrigido;
    }

    if (tarefa.intervaloDias && tarefa.dataInicio) {
        const inicio = new Date(tarefa.dataInicio);
        inicio.setHours(0, 0, 0, 0);

        const diffTempo = alvo.getTime() - inicio.getTime();
        const diffDias = Math.round(diffTempo / (1000 * 60 * 60 * 24));

        if (diffDias < 0) return false; 
        return diffDias % tarefa.intervaloDias === 0;
    }

    return false;
};
