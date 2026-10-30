import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { query, queryOne, withTransaction, lockRow } from '../config/db';
import { validateReturnNfc } from '../services/ReturnReadings';
import { quantityMove } from '../services/QuantityService';
import { audit, text, id, pagination, registrationRoles, operationRoles, updateLoss } from '../services/OperationalService';
import { MaterialService } from '../services/MaterialService';
const router=Router();router.use(authMiddleware);
const handle=(fn:(req:AuthenticatedRequest,res:Response)=>Promise<unknown>)=>(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res)).catch(next);};
router.get('/',handle(async(req,res)=>{
  const p=pagination(req.query),term='%'+String(req.query.busca||'').slice(0,255)+'%';
  const from=`FROM materiais m WHERE m.tipo_controle='QUANTIDADE' AND (m.nome LIKE ? OR m.codigo_interno LIKE ?)`;
  const items=await query(`SELECT m.*, COALESCE((SELECT SUM(e.quantidade-e.devolvida) FROM emprestimos_quantidade e WHERE e.material_id=m.id),0) AS em_operacao ${from} ORDER BY m.nome LIMIT ? OFFSET ?`,[term,term,p.limit,p.offset]);
  const total=await queryOne(`SELECT COUNT(*) AS total ${from}`,[term,term]);res.json({items,total:total.total,...p});
}));
router.get('/emprestimos',handle(async(req,res)=>{
  const p=pagination(req.query),term='%'+String(req.query.busca||'').slice(0,255)+'%';
  const where=`WHERE e.quantidade>e.devolvida AND (c.nome LIKE ? OR c.matricula LIKE ? OR m.nome LIKE ? OR m.codigo_interno LIKE ?) AND (?='' OR c.id=?)`;
  const from=`FROM emprestimos_quantidade e JOIN materiais m ON m.id=e.material_id JOIN colaboradores c ON c.id=e.colaborador_id`;
  const params=[term,term,term,term,req.query.colaborador_id||'',req.query.colaborador_id||''];
  const items=await query(`SELECT e.*, m.nome AS material_nome,m.codigo_interno,m.codigo_barras,m.foto_url,c.nome AS colaborador_nome,c.matricula,c.setor ${from} ${where} ORDER BY e.id DESC LIMIT ? OFFSET ?`,[...params,p.limit,p.offset]);
  const total=await queryOne(`SELECT COUNT(*) AS total ${from} ${where}`,params);res.json({items,total:total.total,...p});
}));
router.post('/',requireRole(registrationRoles),handle(async(req,res)=>{
  const initial=Number(req.body.saldo_inicial||0);if(!Number.isSafeInteger(initial)||initial<0||initial>1000000)throw new Error('Saldo inicial inválido');
  const result=await withTransaction(async execute=>{const {codigo_barras:_legacyBarcode,...materialData}=req.body;const material=await MaterialService.criar(materialData);await execute("UPDATE materiais SET tipo_controle='QUANTIDADE',saldo_disponivel=? WHERE id=?",[initial,material.id]);await audit(req.user!.id,'CADASTRO_QUANTIDADE','material',material.id,{saldo_inicial:initial},execute);return {...material,tipo_controle:'QUANTIDADE',saldo_disponivel:initial};});res.status(201).json(result);
}));
router.post('/movimentar',requireRole(operationRoles),handle(async(req,res)=>{
  if((req.body.tipo==='AJUSTE'||req.body.tipo==='LIBERAR'&&req.body.origem!=='CONFERENCIA')&&!['ADMINISTRADOR','SUPERVISOR'].includes(req.user!.nivel_acesso))return res.status(403).json({error:'Ajustes e liberação de manutenção exigem supervisor ou administrador'});
  const data = {...req.body,requestId:req.header('Idempotency-Key')||req.body.requestId};
  if (data.tipo === 'DEVOLUCAO') {
    return res.json(await withTransaction(async execute => {
      await execute('SELECT id FROM usuarios WHERE id = ?' + lockRow, [req.user!.id]);
      const loan = await queryOne('SELECT colaborador_id, material_id FROM emprestimos_quantidade WHERE id = ?', [id(data.emprestimo_id)]);
      if (!loan) throw new Error('Empréstimo não encontrado');
      await validateReturnNfc(loan.colaborador_id, data.nfcId);
      return quantityMove(data, req.user!.id);
    }));
  }
  res.json(await quantityMove(data,req.user!.id));
}));
router.post('/extravios/:id',requireRole(operationRoles),handle(async(req,res)=>{res.json(await updateLoss(-id(req.params.id),req.body,req.user!.id));}));
export default router;
