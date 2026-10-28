import { withTransaction } from '../config/db';
import { instant } from '../utils/time';

export async function monitoringOverview() {
  const timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
  // Validate the configured operational zone rather than silently using the viewer's zone.
  const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone });
  return withTransaction(async execute => {
    const entries = await execute(`SELECT a.id AS acesso_id, a.colaborador_id, a.entrada, a.destino,
      c.nome, c.matricula, c.cargo, c.setor, c.foto_url, c.empresa, c.turma, c.brigadista, c.brigada_especialidade, c.brigada_validade
      FROM acessos_mina a JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.saida IS NULL ORDER BY a.entrada, a.id`);
    const brigade = await execute(`SELECT c.id AS colaborador_id, c.nome, c.matricula, c.cargo, c.foto_url,
      c.turma, c.setor, c.brigada_especialidade, c.brigada_validade, c.status
      FROM colaboradores c WHERE c.brigadista = 1 ORDER BY c.nome, c.id`);
    const serverTime = Date.now(), today = dateFormat.format(new Date(serverTime));
    const turma = (person: any) => person.turma || (/^TURMA\s+([A-D])$/i.exec(person.setor || '')?.[1]?.toUpperCase()) || '';
    const collaborators = entries.map(entry => {
      const timestamp = entry.entrada ? instant(entry.entrada) : NaN;
      const valid = Number.isFinite(timestamp) && timestamp <= serverTime + 60000;
      return { ...entry, entrada: valid ? new Date(timestamp).toISOString() : null,
        horario_inconsistente: !valid, turma: turma(entry), brigadista: Number(entry.brigadista) === 1 };
    });
    const presentIds = new Set(collaborators.map(person => person.colaborador_id));
    const members = brigade.map(person => ({ ...person, turma: turma(person), na_mina: presentIds.has(person.colaborador_id),
      habilitacao: !person.brigada_validade ? 'NAO_INFORMADA' : person.brigada_validade < today ? 'VENCIDA' : 'VIGENTE' }));
    return {
      horario_servidor: new Date(serverTime).toISOString(), fuso_horario: timeZone, limite_segundos: 6 * 60 * 60,
      colaboradores: collaborators, inconsistencias: collaborators.filter(person => person.horario_inconsistente).length,
      brigadistas: { presentes: members.filter(person => person.na_mina), total: members.length,
        na_mina: members.filter(person => person.na_mina).length, fora_mina: members.filter(person => !person.na_mina).length }
    };
  });
}

export async function monitoringProfile(collaboratorId: number) {
  return withTransaction(async execute => {
    const [person] = await execute(`SELECT id, nome, matricula, cargo, setor, foto_url, empresa, turma, status,
      brigadista, brigada_especialidade, brigada_validade FROM colaboradores WHERE id = ?`, [collaboratorId]);
    if (!person) return null;
    const history = await execute(`SELECT a.id, a.entrada, a.saida, a.destino,
      entrada.nome AS operador_entrada, saida.nome AS operador_saida FROM acessos_mina a
      LEFT JOIN usuarios entrada ON entrada.id = a.operador_entrada_id
      LEFT JOIN usuarios saida ON saida.id = a.operador_saida_id
      WHERE a.colaborador_id = ? ORDER BY a.id DESC LIMIT 10`, [collaboratorId]);
    const asIso = (value: string | null) => {
      if (!value) return null;
      const timestamp = instant(value);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    };
    const normalized = history.map(entry => ({ ...entry, entrada: asIso(entry.entrada), saida: asIso(entry.saida), em_aberto: !entry.saida }));
    // Query presence independently of the limited history, including legacy records.
    const [active] = await execute('SELECT id, entrada, destino FROM acessos_mina WHERE colaborador_id = ? AND saida IS NULL ORDER BY id DESC LIMIT 1', [collaboratorId]);
    return { colaborador: { ...person, brigadista: Number(person.brigadista) === 1 },
      acesso_ativo: active ? { ...active, entrada: asIso(active.entrada) } : null, historico: normalized };
  });
}
