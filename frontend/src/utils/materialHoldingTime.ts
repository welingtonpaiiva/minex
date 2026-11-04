export const MATERIAL_HOLDING_LIMIT_SECONDS = 8 * 3600;

export function materialHoldingTime(withdrawal: string | null | undefined, now: number) {
  const timestamp = withdrawal ? Date.parse(withdrawal) : NaN;
  const seconds = Number.isFinite(timestamp) && timestamp <= now ? Math.floor((now - timestamp) / 1000) : null;
  return { seconds, overdue: seconds !== null && seconds > MATERIAL_HOLDING_LIMIT_SECONDS,
    label: seconds === null ? 'Horário a conferir' : `${String(Math.floor(seconds / 3600)).padStart(2, '0')}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s` };
}
