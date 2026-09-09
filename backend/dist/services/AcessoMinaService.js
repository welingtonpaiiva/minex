"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcessoMinaService = void 0;
const db_1 = require("../config/db");
class AcessoMinaService {
    static async buscarAtivos() {
        const acessos = await (0, db_1.query)(`
      SELECT a.id as acesso_id, a.data_hora_entrada, a.status,
             c.id as colaborador_id, c.nome, c.matricula, c.setor, c.cargo, c.foto_url
      FROM acessos_mina a
      JOIN colaboradores c ON a.colaborador_id = c.id
      WHERE a.status = 'ATIVO'
      ORDER BY a.data_hora_entrada DESC
    `);
        if (!acessos || acessos.length === 0)
            return [];
        const ativosIds = acessos.map((a) => a.colaborador_id);
        const emprestimos = await (0, db_1.query)(`
      SELECT e.id as emprestimo_id, e.colaborador_id, e.data_hora_saida,
             m.id as material_id, m.nome, m.codigo_barras
      FROM emprestimos e
      JOIN materiais m ON e.material_id = m.id
      WHERE e.colaborador_id IN (${ativosIds.join(',')})
    `);
        // Organiza por colaborador
        return acessos.map((acesso) => {
            const materiais = emprestimos.filter((e) => e.colaborador_id === acesso.colaborador_id);
            return {
                ...acesso,
                materiais
            };
        });
    }
    static async buscarHistorico() {
        const acessos = await (0, db_1.query)(`
      SELECT a.id as acesso_id, a.data_hora_entrada, a.data_hora_saida, a.status,
             c.id as colaborador_id, c.nome, c.matricula, c.setor, c.cargo, c.foto_url
      FROM acessos_mina a
      JOIN colaboradores c ON a.colaborador_id = c.id
      WHERE a.status = 'ENCERRADO'
      ORDER BY a.data_hora_saida DESC
      LIMIT 100
    `);
        return acessos || [];
    }
}
exports.AcessoMinaService = AcessoMinaService;
