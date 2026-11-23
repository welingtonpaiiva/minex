"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringOverview = monitoringOverview;
exports.monitoringProfile = monitoringProfile;
const db_1 = require("../config/db");
const time_1 = require("../utils/time");
const MinePresenceService_1 = require("./MinePresenceService");
async function monitoringOverview() {
    const timeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
    // Validate the configured operational zone rather than silently using the viewer's zone.
    const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone });
    return (0, db_1.withTransaction)(async (execute) => {
        const entries = await (0, MinePresenceService_1.minePresence)(execute);
        const brigade = await execute(`SELECT c.id AS colaborador_id, c.nome, c.matricula, c.cargo, c.foto_url,
      c.turma, c.setor, c.brigada_especialidade, c.brigada_validade, c.status
      FROM colaboradores c WHERE c.brigadista = 1 ORDER BY c.nome, c.id`);
        const serverTime = Date.now(), today = dateFormat.format(new Date(serverTime));
        const turma = (person) => person.turma || (/^TURMA\s+([A-D])$/i.exec(person.setor || '')?.[1]?.toUpperCase()) || '';
        const collaborators = entries.map(entry => {
            const timestamp = entry.entrada ? (0, time_1.instant)(entry.entrada) : NaN;
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
async function monitoringProfile(collaboratorId) {
    return (0, db_1.withTransaction)(async (execute) => {
        const [person] = await execute(`SELECT id, nome, matricula, cargo, setor, foto_url, empresa, turma, status,
      brigadista, brigada_especialidade, brigada_validade FROM colaboradores WHERE id = ?`, [collaboratorId]);
        if (!person)
            return null;
        const history = await execute(`SELECT a.id, a.entrada, a.saida, a.destino,
      entrada.nome AS operador_entrada, saida.nome AS operador_saida FROM acessos_mina a
      LEFT JOIN usuarios entrada ON entrada.id = a.operador_entrada_id
      LEFT JOIN usuarios saida ON saida.id = a.operador_saida_id
      WHERE a.colaborador_id = ? ORDER BY a.id DESC LIMIT 10`, [collaboratorId]);
        const asIso = (value) => {
            if (!value)
                return null;
            const timestamp = (0, time_1.instant)(value);
            return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
        };
        const normalized = history.map(entry => ({ ...entry, entrada: asIso(entry.entrada), saida: asIso(entry.saida), em_aberto: !entry.saida }));
        // Query presence independently of the limited history, including legacy records.
        const [active] = await (0, MinePresenceService_1.minePresence)(execute, collaboratorId);
        return { colaborador: { ...person, brigadista: Number(person.brigadista) === 1 },
            acesso_ativo: active ? { id: active.id, entrada: asIso(active.entrada), destino: active.destino,
                origem: active.origem, possui_mascara_fuga: active.possui_mascara_fuga } : null, historico: normalized };
    });
}
