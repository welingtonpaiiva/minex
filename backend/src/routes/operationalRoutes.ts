import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middlewares/authMiddleware';
import { query, queryOne, withTransaction, databaseClient, lockRow } from '../config/db';
import { audit, id, text, roles, operationRoles, trainingRoles, pagination, getCompliance, saveTraining, mineAccess, mineOverview, listLosses, updateLoss } from '../services/OperationalService';
import { today, dayBoundary } from '../utils/time';
const router = Router();
router.use(authMiddleware);
const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
router.get('/status', handle(async (_req, res) => { await query('SELECT 1'); res.json({ conectado: true, banco: databaseClient, horario: new Date().toISOString() }); }));
router.get('/legado', requireRole(['ADMINISTRADOR','SUPERVISOR']), handle(async(req,res)=>{
  const p=pagination(req.query),table=String(req.query.tabela||'equipamentos');
  const schemas=await query('SELECT tabela, sql_original FROM legado_esquemas ORDER BY tabela');
  const items=await query('SELECT registro_id,dados_json FROM legado_registros WHERE tabela=? ORDER BY registro_id LIMIT ? OFFSET ?',[table,p.limit,p.offset]);
  const total=await queryOne('SELECT COUNT(*) AS total FROM legado_registros WHERE tabela=?',[table]);
  res.json({items:items.map(r=>({id:r.registro_id,dados:JSON.parse(r.dados_json)})),total:total.total,esquemas:schemas,...p});
}));
router.get('/acessos', handle(async (_req, res) => { res.json(await mineOverview()); }));
router.post('/acessos', requireRole(operationRoles), handle(async (req, res) => { res.json(await mineAccess(req.body, req.user!.id)); }));
router.get('/acessos/historico', handle(async (req, res) => {
  const p = pagination(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
  const where = '(c.nome LIKE ? OR c.matricula LIKE ?)';
  const items = await query(`SELECT a.*, c.nome, c.matricula, c.setor FROM acessos_mina a JOIN colaboradores c ON c.id=a.colaborador_id
    WHERE ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [term, term, p.limit, p.offset]);
  const count = await queryOne(`SELECT COUNT(*) AS total FROM acessos_mina a JOIN colaboradores c ON c.id=a.colaborador_id WHERE ${where}`, [term, term]);
  res.json({ items, total: count.total, ...p });
}));
router.get('/treinamentos', handle(async (_req, res) => { res.json(await query('SELECT * FROM treinamentos ORDER BY nome')); }));
router.post('/treinamentos', requireRole(trainingRoles), handle(async (req, res) => {
  await withTransaction(async execute => {
    const result = await execute('INSERT INTO treinamentos (nome, descricao, status) VALUES (?, ?, ?)', [text(req.body.nome, 'Nome'), text(req.body.descricao || '', 'Descrição', 4000, false), 'ATIVO']);
    await audit(req.user!.id, 'CRIAR', 'catalogo_treinamento', result[0].id, req.body, execute);
  }); res.status(201).json({ sucesso: true });
}));
router.put('/treinamentos/:id', requireRole(trainingRoles), handle(async (req, res) => {
  const ref = id(req.params.id);
  if (!['ATIVO', 'INATIVO'].includes(req.body.status)) throw new Error('Situação inválida');
  await withTransaction(async execute => {
    if (!await queryOne('SELECT id FROM treinamentos WHERE id = ?' + lockRow, [ref])) throw new Error('Treinamento não encontrado');
    await execute('UPDATE treinamentos SET nome=?, descricao=?, status=? WHERE id=?', [text(req.body.nome, 'Nome'), text(req.body.descricao || '', 'Descrição', 4000, false), req.body.status, ref]);
    await audit(req.user!.id, 'ATUALIZAR', 'catalogo_treinamento', ref, req.body, execute);
  }); res.json({ sucesso: true });
}));
router.get('/conformidade/:id', handle(async (req, res) => { res.json(await getCompliance(id(req.params.id))); }));
router.get('/conformidade', handle(async (req, res) => {
  const p = pagination(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
  const where = `WHERE (c.nome LIKE ? OR c.matricula LIKE ?) AND (? = '' OR c.setor = ?)
    AND (? = '' OR EXISTS (SELECT 1 FROM colaborador_treinamentos ct WHERE ct.colaborador_id=c.id AND ct.treinamento_id=? AND ct.status='ATIVO'))`;
  const params = [term, term, req.query.setor || '', req.query.setor || '', req.query.treinamento || '', req.query.treinamento || ''];
  const status = `CASE
    WHEN EXISTS (SELECT 1 FROM colaborador_treinamentos ct WHERE ct.colaborador_id=c.id AND ct.status='ATIVO' AND ct.obrigatorio=1 AND (ct.impeditivo=1 OR (ct.validade IS NOT NULL AND ct.validade < ?))) THEN 'NAO_CONFORME'
    WHEN EXISTS (SELECT 1 FROM colaborador_treinamentos ct WHERE ct.colaborador_id=c.id AND ct.status='ATIVO' AND ct.obrigatorio=1 AND ct.em_analise=1) THEN 'EM_ANALISE'
    WHEN NOT EXISTS (SELECT 1 FROM colaborador_treinamentos ct WHERE ct.colaborador_id=c.id AND ct.status='ATIVO' AND ct.obrigatorio=1)
      OR EXISTS (SELECT 1 FROM colaborador_treinamentos ct WHERE ct.colaborador_id=c.id AND ct.status='ATIVO' AND ct.obrigatorio=1 AND (ct.realizacao IS NULL OR ct.realizacao > ? OR (ct.validade IS NULL AND ct.sem_vencimento=0))) THEN 'PENDENTE'
    ELSE 'CONFORME' END AS conformidade`;
  const base = `SELECT c.*, ${status} FROM colaboradores c ${where}`;
  const values = [today(), today(), ...params, req.query.situacao || '', req.query.situacao || ''];
  const filter = " WHERE (? = '' OR resultado.conformidade = ?)";
  const total = await queryOne(`SELECT COUNT(*) AS total FROM (${base}) resultado ${filter}`, values);
  const items = await query(`SELECT * FROM (${base}) resultado ${filter} ORDER BY nome LIMIT ? OFFSET ?`, [...values, p.limit, p.offset]);
  res.json({ items, total: total.total, ...p });
}));
router.post('/conformidade', requireRole(trainingRoles), handle(async (req, res) => { res.status(201).json(await saveTraining(null, req.body, req.user!.id)); }));
router.put('/conformidade/:id', requireRole(trainingRoles), handle(async (req, res) => { res.json(await saveTraining(id(req.params.id), req.body, req.user!.id)); }));
router.get('/setores', handle(async (_req, res) => { res.json(await query("SELECT DISTINCT setor FROM colaboradores WHERE setor <> '' ORDER BY setor")); }));
router.get('/extravios', handle(async (req, res) => { res.json(await listLosses(req.query)); }));
router.post('/extravios/:emprestimoId', requireRole(operationRoles), handle(async (req, res) => { res.json(await updateLoss(id(req.params.emprestimoId), req.body, req.user!.id)); }));
router.get('/auditoria', requireRole(['ADMINISTRADOR', 'SUPERVISOR']), handle(async (req, res) => {
  const p = pagination(req.query); let where = 'WHERE 1=1'; const params: any[] = [];
  for (const field of ['entidade', 'referencia_id', 'usuario_id', 'acao']) if (req.query[field]) { where += ` AND a.${field} = ?`; params.push(req.query[field]); }
  if (req.query.data_inicio) { where += ' AND a.data_hora >= ?'; params.push(dayBoundary(String(req.query.data_inicio))); }
  if (req.query.data_fim) { where += ' AND a.data_hora <= ?'; params.push(dayBoundary(String(req.query.data_fim),true)); }
  res.json({ items: await query(`SELECT a.*, u.nome AS usuario_nome FROM auditoria a JOIN usuarios u ON u.id=a.usuario_id ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]),
    total: (await queryOne(`SELECT COUNT(*) AS total FROM auditoria a ${where}`, params)).total, ...p });
}));
router.put('/usuarios/:id', requireRole(['ADMINISTRADOR']), handle(async (req, res) => {
  const ref = id(req.params.id), { nivel_acesso, status } = req.body;
  if (!roles.includes(nivel_acesso) || !['ATIVO', 'INATIVO'].includes(status)) throw new Error('Perfil ou situação inválida');
  if (ref === req.user!.id && (status !== 'ATIVO' || nivel_acesso !== 'ADMINISTRADOR')) throw new Error('Use outra conta administrativa para alterar o seu próprio acesso');
  await withTransaction(async execute => {
    if (!await queryOne('SELECT id FROM usuarios WHERE id = ?' + lockRow, [ref])) throw new Error('Usuário não encontrado');
    await execute('UPDATE usuarios SET nivel_acesso=?, status=?, updated_at=? WHERE id=?', [nivel_acesso, status, new Date().toISOString(), ref]);
    await audit(req.user!.id, 'PERMISSOES', 'usuario', ref, { nivel_acesso, status }, execute);
  }); res.json({ sucesso: true });
}));
export default router;
