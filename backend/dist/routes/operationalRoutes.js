"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const db_1 = require("../config/db");
const OperationalService_1 = require("../services/OperationalService");
const time_1 = require("../utils/time");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
const handle = (fn) => (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
router.get('/status', handle(async (_req, res) => { await (0, db_1.query)('SELECT 1'); res.json({ conectado: true, banco: db_1.databaseClient, horario: new Date().toISOString() }); }));
router.get('/legado', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR', 'SUPERVISOR']), handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query), table = String(req.query.tabela || 'equipamentos');
    const schemas = await (0, db_1.query)('SELECT tabela, sql_original FROM legado_esquemas ORDER BY tabela');
    const items = await (0, db_1.query)('SELECT registro_id,dados_json FROM legado_registros WHERE tabela=? ORDER BY registro_id LIMIT ? OFFSET ?', [table, p.limit, p.offset]);
    const total = await (0, db_1.queryOne)('SELECT COUNT(*) AS total FROM legado_registros WHERE tabela=?', [table]);
    res.json({ items: items.map(r => ({ id: r.registro_id, dados: JSON.parse(r.dados_json) })), total: total.total, esquemas: schemas, ...p });
}));
router.get('/acessos', handle(async (_req, res) => { res.json(await (0, OperationalService_1.mineOverview)()); }));
router.post('/acessos', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), handle(async (req, res) => { res.json(await (0, OperationalService_1.mineAccess)(req.body, req.user.id)); }));
router.get('/acessos/historico', handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
    const where = '(c.nome LIKE ? OR c.matricula LIKE ?)';
    const items = await (0, db_1.query)(`SELECT a.*, c.nome, c.matricula, c.setor FROM acessos_mina a JOIN colaboradores c ON c.id=a.colaborador_id
    WHERE ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [term, term, p.limit, p.offset]);
    const count = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total FROM acessos_mina a JOIN colaboradores c ON c.id=a.colaborador_id WHERE ${where}`, [term, term]);
    res.json({ items, total: count.total, ...p });
}));
router.get('/treinamentos', handle(async (_req, res) => { res.json(await (0, db_1.query)('SELECT * FROM treinamentos ORDER BY nome')); }));
router.post('/treinamentos', (0, authMiddleware_1.requireRole)(OperationalService_1.trainingRoles), handle(async (req, res) => {
    await (0, db_1.withTransaction)(async (execute) => {
        const result = await execute('INSERT INTO treinamentos (nome, descricao, status) VALUES (?, ?, ?)', [(0, OperationalService_1.text)(req.body.nome, 'Nome'), (0, OperationalService_1.text)(req.body.descricao || '', 'Descrição', 4000, false), 'ATIVO']);
        await (0, OperationalService_1.audit)(req.user.id, 'CRIAR', 'catalogo_treinamento', result[0].id, req.body, execute);
    });
    res.status(201).json({ sucesso: true });
}));
router.put('/treinamentos/:id', (0, authMiddleware_1.requireRole)(OperationalService_1.trainingRoles), handle(async (req, res) => {
    const ref = (0, OperationalService_1.id)(req.params.id);
    if (!['ATIVO', 'INATIVO'].includes(req.body.status))
        throw new Error('Situação inválida');
    await (0, db_1.withTransaction)(async (execute) => {
        if (!await (0, db_1.queryOne)('SELECT id FROM treinamentos WHERE id = ?' + db_1.lockRow, [ref]))
            throw new Error('Treinamento não encontrado');
        await execute('UPDATE treinamentos SET nome=?, descricao=?, status=? WHERE id=?', [(0, OperationalService_1.text)(req.body.nome, 'Nome'), (0, OperationalService_1.text)(req.body.descricao || '', 'Descrição', 4000, false), req.body.status, ref]);
        await (0, OperationalService_1.audit)(req.user.id, 'ATUALIZAR', 'catalogo_treinamento', ref, req.body, execute);
    });
    res.json({ sucesso: true });
}));
router.get('/conformidade/:id', handle(async (req, res) => { res.json(await (0, OperationalService_1.getCompliance)((0, OperationalService_1.id)(req.params.id))); }));
router.get('/conformidade', handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
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
    const values = [(0, time_1.today)(), (0, time_1.today)(), ...params, req.query.situacao || '', req.query.situacao || ''];
    const filter = " WHERE (? = '' OR resultado.conformidade = ?)";
    const total = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total FROM (${base}) resultado ${filter}`, values);
    const items = await (0, db_1.query)(`SELECT * FROM (${base}) resultado ${filter} ORDER BY nome LIMIT ? OFFSET ?`, [...values, p.limit, p.offset]);
    res.json({ items, total: total.total, ...p });
}));
router.post('/conformidade', (0, authMiddleware_1.requireRole)(OperationalService_1.trainingRoles), handle(async (req, res) => { res.status(201).json(await (0, OperationalService_1.saveTraining)(null, req.body, req.user.id)); }));
router.put('/conformidade/:id', (0, authMiddleware_1.requireRole)(OperationalService_1.trainingRoles), handle(async (req, res) => { res.json(await (0, OperationalService_1.saveTraining)((0, OperationalService_1.id)(req.params.id), req.body, req.user.id)); }));
router.get('/setores', handle(async (_req, res) => { res.json(await (0, db_1.query)("SELECT DISTINCT setor FROM colaboradores WHERE setor <> '' ORDER BY setor")); }));
router.get('/extravios', handle(async (req, res) => { res.json(await (0, OperationalService_1.listLosses)(req.query)); }));
router.post('/extravios/:emprestimoId', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), handle(async (req, res) => { res.json(await (0, OperationalService_1.updateLoss)((0, OperationalService_1.id)(req.params.emprestimoId), req.body, req.user.id)); }));
router.get('/auditoria', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR', 'SUPERVISOR']), handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query);
    let where = 'WHERE 1=1';
    const params = [];
    for (const field of ['entidade', 'referencia_id', 'usuario_id', 'acao'])
        if (req.query[field]) {
            where += ` AND a.${field} = ?`;
            params.push(req.query[field]);
        }
    if (req.query.data_inicio) {
        where += ' AND a.data_hora >= ?';
        params.push((0, time_1.dayBoundary)(String(req.query.data_inicio)));
    }
    if (req.query.data_fim) {
        where += ' AND a.data_hora <= ?';
        params.push((0, time_1.dayBoundary)(String(req.query.data_fim), true));
    }
    res.json({ items: await (0, db_1.query)(`SELECT a.*, u.nome AS usuario_nome FROM auditoria a JOIN usuarios u ON u.id=a.usuario_id ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]),
        total: (await (0, db_1.queryOne)(`SELECT COUNT(*) AS total FROM auditoria a ${where}`, params)).total, ...p });
}));
router.put('/usuarios/:id', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), handle(async (req, res) => {
    const ref = (0, OperationalService_1.id)(req.params.id), { nivel_acesso, status } = req.body;
    if (!OperationalService_1.roles.includes(nivel_acesso) || !['ATIVO', 'INATIVO'].includes(status))
        throw new Error('Perfil ou situação inválida');
    if (ref === req.user.id && (status !== 'ATIVO' || nivel_acesso !== 'ADMINISTRADOR'))
        throw new Error('Use outra conta administrativa para alterar o seu próprio acesso');
    await (0, db_1.withTransaction)(async (execute) => {
        if (!await (0, db_1.queryOne)('SELECT id FROM usuarios WHERE id = ?' + db_1.lockRow, [ref]))
            throw new Error('Usuário não encontrado');
        await execute('UPDATE usuarios SET nivel_acesso=?, status=?, updated_at=? WHERE id=?', [nivel_acesso, status, new Date().toISOString(), ref]);
        await (0, OperationalService_1.audit)(req.user.id, 'PERMISSOES', 'usuario', ref, { nivel_acesso, status }, execute);
    });
    res.json({ sucesso: true });
}));
exports.default = router;
