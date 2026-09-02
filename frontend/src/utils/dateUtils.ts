export const calcularHorasEmUso = (dataHoraSaidaStr?: string): { horas: number; diffMinutos: number; excedeu: boolean } => {
  if (!dataHoraSaidaStr) return { horas: 0, diffMinutos: 0, excedeu: false };

  // Tratar formatos SQLite ("2026-09-01 02:30:00" ou "2026-09-01T02:30:00")
  const formattedStr = dataHoraSaidaStr.includes('T')
    ? dataHoraSaidaStr
    : dataHoraSaidaStr.replace(' ', 'T');

  const dataSaida = new Date(formattedStr);
  if (isNaN(dataSaida.getTime())) return { horas: 0, diffMinutos: 0, excedeu: false };

  const agora = new Date();
  const diffMs = agora.getTime() - dataSaida.getTime();
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  const horas = Math.floor(diffMinutos / 60);

  return {
    horas: Math.max(0, horas),
    diffMinutos: Math.max(0, diffMinutos),
    excedeu: diffMinutos >= 450 // 7h30min
  };
};
