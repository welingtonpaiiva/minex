export interface MonitorPerson {
  acesso_id: number;
  colaborador_id: number;
  nome: string;
  matricula: string;
  cargo: string;
  setor: string;
  foto_url: string;
  empresa: string;
  turma: string;
  entrada: string | null;
  horario_inconsistente: boolean;
  brigadista: boolean;
}
export interface MonitorBrigadist {
  colaborador_id: number;
  nome: string;
  matricula: string;
  cargo: string;
  foto_url: string;
  turma: string;
  brigada_especialidade: string;
  habilitacao: 'NAO_INFORMADA' | 'VENCIDA' | 'VIGENTE';
  na_mina: boolean;
  status: string;
}
export interface MonitoringSnapshot {
  horario_servidor: string;
  fuso_horario: string;
  limite_segundos: number;
  inconsistencias: number;
  colaboradores: MonitorPerson[];
  brigadistas: { presentes: MonitorBrigadist[]; total: number; na_mina: number; fora_mina: number };
}
export interface TimedPerson extends MonitorPerson { seconds: number | null; critical: boolean; invalid: boolean }
export function timedPerson(person: MonitorPerson, now: number, limit = 21600): TimedPerson {
  const timestamp = person.entrada ? Date.parse(person.entrada) : NaN;
  const invalid = person.horario_inconsistente || !Number.isFinite(timestamp);
  const seconds = invalid ? null : Math.max(0, Math.floor((now - timestamp) / 1000));
  return { ...person, seconds, invalid, critical: seconds !== null && seconds > limit };
}
export function orderPeople(people: MonitorPerson[], now: number, limit = 21600) {
  return people.map(person => timedPerson(person, now, limit)).sort((a, b) =>
    Number(b.critical) - Number(a.critical) || Number(b.invalid) - Number(a.invalid) ||
    (b.seconds ?? 0) - (a.seconds ?? 0) || a.acesso_id - b.acesso_id);
}
export function monitorPage(people: TimedPerson[], capacity: number, requestedPage: number) {
  const fixed = people.filter(person => person.critical || person.invalid);
  const regular = people.filter(person => !person.critical && !person.invalid);
  const slots = Math.max(0, Math.max(1, capacity) - fixed.length);
  const pages = slots ? Math.max(1, Math.ceil(regular.length / slots)) : 1;
  const page = ((requestedPage % pages) + pages) % pages;
  return { visible: [...fixed, ...regular.slice(page * slots, page * slots + slots)], pages, page,
    overflow: fixed.length > capacity, waiting: slots ? 0 : regular.length, fixedCount: fixed.length };
}
export function elapsedLabel(seconds: number | null) {
  if (seconds === null) return '—';
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}
