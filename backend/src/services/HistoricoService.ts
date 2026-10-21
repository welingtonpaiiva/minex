import { query, databaseClient } from '../config/db';
import { dayBoundary } from '../utils/time';

export class HistoricoService {
  static async listar(filtros?: {
    busca?: string;
    tipo?: string;
    colaborador_id?: number;
    material_id?: number;
    data_inicio?: string;
    data_fim?: string;
    limit?: number;
    offset?: number;
  }) {
    let sql = 'SELECT * FROM movimentacoes WHERE 1=1';
    const timestamp = databaseClient === 'mysql' ? 'data_hora' : "CASE WHEN instr(data_hora,'T')>0 THEN strftime('%Y-%m-%dT%H:%M:%fZ',data_hora) ELSE strftime('%Y-%m-%dT%H:%M:%fZ',data_hora || '-03:00') END";
    const params: any[] = [];

    if (filtros?.tipo && filtros.tipo !== 'TODOS') {
      sql += ' AND tipo = ?';
      params.push(filtros.tipo);
    }

    if (filtros?.colaborador_id) {
      sql += ' AND colaborador_id = ?';
      params.push(filtros.colaborador_id);
    }

    if (filtros?.material_id) {
      sql += ' AND material_id = ?';
      params.push(filtros.material_id);
    }

    if (filtros?.data_inicio) {
      sql += ' AND ' + timestamp + ' >= ?';
      params.push(dayBoundary(filtros.data_inicio));
    }

    if (filtros?.data_fim) {
      sql += ' AND ' + timestamp + ' <= ?';
      params.push(dayBoundary(filtros.data_fim, true));
    }

    if (filtros?.busca) {
      sql += ' AND (material_nome LIKE ? OR material_codigo LIKE ? OR colaborador_nome LIKE ? OR colaborador_matricula LIKE ? OR operador_nome LIKE ?)';
      const term = `%${filtros.busca.trim()}%`;
      params.push(term, term, term, term, term);
    }

    const count = await query<{ total: number }>(sql.replace('SELECT *', 'SELECT COUNT(*) AS total'), params);
    sql += ' ORDER BY ' + timestamp + ' DESC, id DESC';

    sql += ' LIMIT ? OFFSET ?';
    params.push(Math.min(500, Math.max(1, filtros?.limit || 50)), Math.max(0, filtros?.offset || 0));

    const rows = await query(sql, params);
    Object.defineProperty(rows, 'total', { value: Number(count[0].total), enumerable: false });
    return rows;
  }

  static async historicoColaborador(colaboradorId: number) {
    return await query(
      'SELECT * FROM movimentacoes WHERE colaborador_id = ? ORDER BY data_hora DESC',
      [colaboradorId]
    );
  }

  static async historicoMaterial(materialId: number) {
    return await query(
      'SELECT * FROM movimentacoes WHERE material_id = ? ORDER BY data_hora DESC',
      [materialId]
    );
  }
}
