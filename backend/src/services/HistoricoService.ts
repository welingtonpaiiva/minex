import { query } from '../config/db';

export class HistoricoService {
  static async listar(filtros?: {
    busca?: string;
    tipo?: string;
    colaborador_id?: number;
    material_id?: number;
    data_inicio?: string;
    data_fim?: string;
    limit?: number;
  }) {
    let sql = 'SELECT * FROM movimentacoes WHERE 1=1';
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
      sql += ' AND data_hora >= ?';
      params.push(`${filtros.data_inicio} 00:00:00`);
    }

    if (filtros?.data_fim) {
      sql += ' AND data_hora <= ?';
      params.push(`${filtros.data_fim} 23:59:59`);
    }

    if (filtros?.busca) {
      sql += ' AND (material_nome LIKE ? OR material_codigo LIKE ? OR colaborador_nome LIKE ? OR colaborador_matricula LIKE ? OR operador_nome LIKE ?)';
      const term = `%${filtros.busca.trim()}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY data_hora DESC, id DESC';

    if (filtros?.limit) {
      sql += ' LIMIT ?';
      params.push(filtros.limit);
    }

    return await query(sql, params);
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
