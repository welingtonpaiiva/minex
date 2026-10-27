import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/authMiddleware';
import { query, queryOne } from '../config/db';
import { pagination } from '../services/OperationalService';
import { materialCategoryOrder } from '../utils/materialOrder';
const router = Router(); router.use(authMiddleware);
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const p = pagination(req.query), params: any[] = [];
    let where = "WHERE m.tipo_controle = 'INDIVIDUAL'";
    if (req.query.busca) { where += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR m.codigo_barras LIKE ? OR col.nome LIKE ? OR col.matricula LIKE ?)'; params.push(...Array(5).fill('%' + String(req.query.busca).slice(0, 255) + '%')); }
    if (req.query.categoria_id === 'sem-categoria') where += ' AND m.categoria_id IS NULL';
    else if (req.query.categoria_id) { where += ' AND m.categoria_id = ?'; params.push(Number(req.query.categoria_id)); }
    const counterWhere = where, counterParams = [...params];
    if (req.query.status) { where += ' AND m.status = ?'; params.push(req.query.status); }
    const from = `FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      LEFT JOIN emprestimos e ON e.material_id=m.id LEFT JOIN colaboradores col ON col.id=e.colaborador_id`;
    const items = await query(`SELECT m.*, c.nome AS categoria_nome, col.nome AS colaborador_nome,
      col.matricula AS colaborador_matricula, e.data_hora_saida, e.id AS emprestimo_id ${from} ${where} ORDER BY ${materialCategoryOrder} LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
    const total = await queryOne(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    const counts = await query(`SELECT m.status, COUNT(*) AS total ${from} ${counterWhere} GROUP BY m.status`, counterParams);
    const categorias = await query(`SELECT m.categoria_id AS id, COALESCE(c.nome, 'Sem categoria') AS nome, COUNT(*) AS total
      FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      WHERE m.tipo_controle='INDIVIDUAL' GROUP BY m.categoria_id, c.nome
      ORDER BY CASE WHEN m.categoria_id IS NULL THEN 1 ELSE 0 END, c.nome`);
    res.json({ items, total: total.total, ...p, categorias, contadores: Object.fromEntries(counts.map(c => [c.status, c.total])) });
  } catch (error) { next(error); }
});
export default router;
