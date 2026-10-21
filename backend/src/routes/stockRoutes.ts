import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/authMiddleware';
import { query, queryOne } from '../config/db';
import { pagination } from '../services/OperationalService';
const router = Router(); router.use(authMiddleware);
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const p = pagination(req.query), params: any[] = [];
    let where = "WHERE m.tipo_controle = 'INDIVIDUAL'";
    if (req.query.busca) { where += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR col.nome LIKE ? OR col.matricula LIKE ?)'; params.push(...Array(4).fill('%' + String(req.query.busca).slice(0, 255) + '%')); }
    if (req.query.status) { where += ' AND m.status = ?'; params.push(req.query.status); }
    if (req.query.categoria_id) { where += ' AND m.categoria_id = ?'; params.push(Number(req.query.categoria_id)); }
    const from = `FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      LEFT JOIN emprestimos e ON e.material_id=m.id LEFT JOIN colaboradores col ON col.id=e.colaborador_id`;
    const items = await query(`SELECT m.*, c.nome AS categoria_nome, col.nome AS colaborador_nome,
      col.matricula AS colaborador_matricula, e.data_hora_saida, e.id AS emprestimo_id ${from} ${where} ORDER BY m.codigo_interno LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
    const total = await queryOne(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    const counts = await query("SELECT status, COUNT(*) AS total FROM materiais WHERE tipo_controle='INDIVIDUAL' GROUP BY status");
    res.json({ items, total: total.total, ...p, contadores: Object.fromEntries(counts.map(c => [c.status, c.total])) });
  } catch (error) { next(error); }
});
export default router;
