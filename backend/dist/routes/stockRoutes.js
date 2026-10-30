"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const db_1 = require("../config/db");
const OperationalService_1 = require("../services/OperationalService");
const materialOrder_1 = require("../utils/materialOrder");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/', async (req, res, next) => {
    try {
        const p = (0, OperationalService_1.pagination)(req.query), params = [];
        let where = "WHERE m.tipo_controle = 'INDIVIDUAL'";
        if (req.query.busca) {
            where += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR m.codigo_barras LIKE ? OR m.patrimonio LIKE ? OR col.nome LIKE ? OR col.matricula LIKE ?)';
            params.push(...Array(6).fill('%' + String(req.query.busca).slice(0, 255) + '%'));
        }
        if (req.query.categoria_id === 'sem-categoria')
            where += ' AND m.categoria_id IS NULL';
        else if (req.query.categoria_id) {
            where += ' AND m.categoria_id = ?';
            params.push(Number(req.query.categoria_id));
        }
        const counterWhere = where, counterParams = [...params];
        if (req.query.status) {
            where += ' AND m.status = ?';
            params.push(req.query.status);
        }
        const from = `FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      LEFT JOIN emprestimos e ON e.material_id=m.id LEFT JOIN colaboradores col ON col.id=e.colaborador_id`;
        const items = await (0, db_1.query)(`SELECT m.*, c.nome AS categoria_nome, col.nome AS colaborador_nome,
      col.matricula AS colaborador_matricula, e.data_hora_saida, e.id AS emprestimo_id ${from} ${where} ORDER BY ${materialOrder_1.materialCategoryOrder} LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
        const total = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total ${from} ${where}`, params);
        const counts = await (0, db_1.query)(`SELECT m.status, COUNT(*) AS total ${from} ${counterWhere} GROUP BY m.status`, counterParams);
        const categorias = await (0, db_1.query)(`SELECT m.categoria_id AS id, COALESCE(c.nome, 'Sem categoria') AS nome, COUNT(*) AS total
      FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      WHERE m.tipo_controle='INDIVIDUAL' GROUP BY m.categoria_id, c.nome
      ORDER BY CASE WHEN m.categoria_id IS NULL THEN 1 ELSE 0 END, c.nome`);
        res.json({ items, total: total.total, ...p, categorias, contadores: Object.fromEntries(counts.map(c => [c.status, c.total])) });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
