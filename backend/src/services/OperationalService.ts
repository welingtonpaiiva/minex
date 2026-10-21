import { Executor, query, queryOne, withTransaction, lockRow, databaseClient } from '../config/db';
import { now, elapsed, duration, today, instant } from '../utils/time';

export const operationRoles = ['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'OPERADOR_ESTOQUE'];
export const registrationRoles = ['ADMINISTRADOR', 'SUPERVISOR', 'CADASTRO'];
export const trainingRoles = ['ADMINISTRADOR', 'SUPERVISOR', 'CADASTRO'];
export const roles = ['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'OPERADOR_ESTOQUE', 'CADASTRO', 'CONSULTA'];
export function text(value: unknown, label: string, max = 255, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new Error(`${label} inválido`);
  return value.trim();
}
export function id(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Identificador inválido');
  return number;
}
export function pagination(data: any) {
  const page = Math.max(1, Math.floor(Number(data.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(data.limit) || 30)));
  return { page, limit, offset: (page - 1) * limit };
}
export async function audit(userId: number, action: string, entity: string, ref: number, details: unknown, execute: Executor = query) {
  await execute('INSERT INTO auditoria (usuario_id, acao, entidade, referencia_id, detalhes, data_hora) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, action, entity, ref, JSON.stringify(details), now()]);
}
export type Compliance = 'CONFORME' | 'PENDENTE' | 'NAO_CONFORME' | 'EM_ANALISE';
export function compliance(records: any[], date = today()): Compliance {
  const mandatory = records.filter(r => r.status === 'ATIVO' && Number(r.obrigatorio));
  if (!mandatory.length) return 'PENDENTE';
  if (mandatory.some(r => Number(r.impeditivo) || (r.validade && r.validade < date))) return 'NAO_CONFORME';
  if (mandatory.some(r => Number(r.em_analise))) return 'EM_ANALISE';
  if (mandatory.some(r => !r.realizacao || r.realizacao > date || (!r.validade && !Number(r.sem_vencimento)))) return 'PENDENTE';
  return 'CONFORME';
}
export async function getCompliance(collaboratorId: number) {
  const records = await query(`SELECT ct.*, t.nome AS treinamento_nome, u.nome AS responsavel_nome
    FROM colaborador_treinamentos ct JOIN treinamentos t ON t.id = ct.treinamento_id
    JOIN usuarios u ON u.id = ct.responsavel_id WHERE ct.colaborador_id = ? ORDER BY t.nome`, [collaboratorId]);
  return { situacao: compliance(records), treinamentos: records };
}
export async function saveTraining(recordId: number | null, data: any, userId: number) {
  return withTransaction(async execute => {
    const collaborator = id(data.colaborador_id), training = id(data.treinamento_id);
    if (!await queryOne('SELECT id FROM colaboradores WHERE id = ?', [collaborator])) throw new Error('Colaborador não encontrado');
    if (!await queryOne("SELECT id FROM treinamentos WHERE id = ? AND status = 'ATIVO'", [training])) throw new Error('Treinamento inativo ou inexistente');
    const date = (value: any) => {
      if (!value) return null;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Data inválida');
      return value;
    };
    const completed = date(data.realizacao), expires = date(data.validade);
    if (completed && completed > today()) throw new Error('A realização não pode estar no futuro');
    if (completed && expires && expires < completed) throw new Error('Validade anterior à realização');
    const noExpiry = data.sem_vencimento === true || data.sem_vencimento === 1;
    if (noExpiry && expires) throw new Error('Informe validade ou sem vencimento');
    if (!['ATIVO', 'INATIVO'].includes(data.status || 'ATIVO')) throw new Error('Situação inválida');
    const values = [collaborator, training, data.obrigatorio === false || data.obrigatorio === 0 ? 0 : 1,
      completed, expires, noExpiry ? 1 : 0, data.em_analise ? 1 : 0, data.impeditivo ? 1 : 0,
      data.status || 'ATIVO', text(data.observacao || '', 'Observação', 4000, false), userId, now()];
    let ref = recordId;
    if (ref) {
      const previous = await queryOne('SELECT * FROM colaborador_treinamentos WHERE id = ?' + lockRow, [ref]);
      if (!previous || previous.colaborador_id !== collaborator || previous.treinamento_id !== training) throw new Error('Vínculo de treinamento inválido');
      await execute(`UPDATE colaborador_treinamentos SET colaborador_id=?, treinamento_id=?, obrigatorio=?, realizacao=?, validade=?,
        sem_vencimento=?, em_analise=?, impeditivo=?, status=?, observacao=?, responsavel_id=?, updated_at=? WHERE id=?`, [...values, ref]);
    } else {
      const result = await execute(`INSERT INTO colaborador_treinamentos
        (colaborador_id, treinamento_id, obrigatorio, realizacao, validade, sem_vencimento, em_analise, impeditivo, status, observacao, responsavel_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
      ref = result[0].id;
    }
    await audit(userId, recordId ? 'ATUALIZAR' : 'CRIAR', 'treinamento', ref!, data, execute);
    return getCompliance(collaborator);
  });
}
export async function mineAccess(data: any, userId: number) {
  return withTransaction(async execute => {
    const collaborator = await queryOne('SELECT * FROM colaboradores WHERE id = ?' + lockRow, [id(data.colaborador_id)]);
    if (!collaborator) throw new Error('Colaborador não encontrado');
    const active = await queryOne('SELECT * FROM acessos_mina WHERE ativo_colaborador_id = ?' + lockRow, [collaborator.id]);
    if (data.tipo === 'ENTRADA') {
      if (collaborator.status !== 'ATIVO') throw new Error('Colaborador inativo');
      if (active) throw new Error('Já existe uma entrada ativa para este colaborador');
      const status = await getCompliance(collaborator.id);
      if (status.situacao !== 'CONFORME') throw new Error('Acesso bloqueado: conformidade ' + status.situacao.replace('_', ' '));
      const result = await execute(`INSERT INTO acessos_mina (colaborador_id, entrada, operador_entrada_id, destino, justificativa, ativo_colaborador_id)
        VALUES (?, ?, ?, ?, ?, ?)`, [collaborator.id, now(), userId, text(data.destino || '', 'Destino', 255, false), '', collaborator.id]);
      await audit(userId, 'ENTRADA_MINA', 'acesso', result[0].id, { colaborador_id: collaborator.id }, execute);
    } else if (data.tipo === 'SAIDA') {
      if (!active) throw new Error('Não há entrada ativa para registrar a saída');
      await execute('UPDATE acessos_mina SET saida = ?, operador_saida_id = ?, ativo_colaborador_id = NULL WHERE id = ?', [now(), userId, active.id]);
      await audit(userId, 'SAIDA_MINA', 'acesso', active.id, { colaborador_id: collaborator.id }, execute);
    } else throw new Error('Tipo de acesso inválido');
    return { sucesso: true };
  });
}
export async function mineOverview() {
  const rows = await query(`SELECT a.*, c.nome, c.matricula, c.setor, c.foto_url
    FROM acessos_mina a JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.saida IS NULL ORDER BY a.entrada`);
  const entries = rows.map(row => { const minutes = elapsed(row.entrada); return { ...row, entrada: new Date(instant(row.entrada)).toISOString(), minutos: minutes, tempo: duration(minutes), excedido: Date.now() - instant(row.entrada) > 8 * 3600000 }; });
  return { atualizado_em: now(), dentro_mina: entries.length, quantidade: entries.filter(e => e.excedido).length, colaboradores: entries };
}
export async function listLosses(filters: any) {
  const paging = pagination(filters), search = '%' + String(filters.busca || '').slice(0, 255) + '%';
  const epoch = (column: string) => databaseClient === 'mysql'
    ? "UNIX_TIMESTAMP(REPLACE(REPLACE(" + column + ", 'T', ' '), 'Z', ''))"
    : "CAST(strftime('%s', CASE WHEN instr(" + column + ", 'T')>0 THEN " + column + " ELSE replace(" + column + ", ' ', 'T') || '" + (process.env.LEGACY_TIME_OFFSET || '-03:00') + "' END) AS INTEGER)";
  const sources = `SELECT e.id AS emprestimo_id,e.material_id,e.colaborador_id,e.data_hora_saida AS retirada,e.prazo_devolucao,e.destino,
    m.nome AS material_nome,m.codigo_interno,m.patrimonio,c.nome AS colaborador_nome,c.matricula,c.setor,
    x.id,x.identificado_em,x.descricao,COALESCE(x.situacao,'EM_OPERACAO') AS situacao,x.responsavel_id,1 AS quantidade
    FROM emprestimos e JOIN materiais m ON m.id=e.material_id JOIN colaboradores c ON c.id=e.colaborador_id
    LEFT JOIN extravios x ON x.emprestimo_origem_id=e.id
    UNION ALL
    SELECT -e.id,e.material_id,e.colaborador_id,e.retirada,e.prazo_devolucao,e.destino,
    m.nome,m.codigo_interno,m.patrimonio,c.nome,c.matricula,c.setor,
    x.id,x.identificado_em,x.descricao,COALESCE(x.situacao,'EM_OPERACAO'),x.responsavel_id,e.quantidade-e.devolvida
    FROM emprestimos_quantidade e JOIN materiais m ON m.id=e.material_id JOIN colaboradores c ON c.id=e.colaborador_id
    LEFT JOIN extravios x ON x.emprestimo_origem_id=-e.id WHERE e.quantidade>e.devolvida
    UNION ALL
    SELECT x.emprestimo_origem_id,x.material_id,x.colaborador_id,x.retirada,x.prazo_devolucao,x.destino,
    m.nome,m.codigo_interno,m.patrimonio,c.nome,c.matricula,c.setor,x.id,x.identificado_em,x.descricao,x.situacao,x.responsavel_id,x.quantidade
    FROM extravios x JOIN materiais m ON m.id=x.material_id JOIN colaboradores c ON c.id=x.colaborador_id
    WHERE NOT EXISTS(SELECT 1 FROM emprestimos e WHERE e.id=x.emprestimo_origem_id)
    AND NOT EXISTS(SELECT 1 FROM emprestimos_quantidade e WHERE -e.id=x.emprestimo_origem_id AND e.quantidade>e.devolvida)`;
  const seconds = Math.floor(Date.now()/1000);
  const cte = `WITH origem AS (${sources}), prazos AS (
    SELECT origem.*, CASE WHEN prazo_devolucao IS NOT NULL THEN ? > ${epoch('prazo_devolucao')}
    ELSE ? - ${epoch('retirada')} > 86400 END AS atrasado,
    (? - ${epoch('retirada')}) AS segundos FROM origem
    WHERE (material_nome LIKE ? OR codigo_interno LIKE ? OR colaborador_nome LIKE ? OR matricula LIKE ?)
    AND (?='' OR setor=?)),
    resultado AS (SELECT prazos.*, CASE WHEN situacao='EM_OPERACAO' AND atrasado=1 THEN 'DEVOLUCAO_ATRASADA' ELSE situacao END AS situacao_efetiva FROM prazos)`;
  const params: any[] = [seconds, seconds, seconds, search, search, search, search, filters.setor || '', filters.setor || ''];
  let where = 'WHERE 1=1';
  if(filters.situacao){where+=' AND situacao_efetiva=?';params.push(filters.situacao);}
  if(filters.atrasados==='true') where+=" AND atrasado=1 AND situacao_efetiva NOT IN ('DEVOLVIDO','ENCERRADO')";
  const total = await queryOne(cte+' SELECT COUNT(*) AS total FROM resultado '+where,params);
  const rows = await query(cte+' SELECT * FROM resultado '+where+' ORDER BY retirada ASC,emprestimo_id LIMIT ? OFFSET ?',[...params,paging.limit,paging.offset]);
  const items=rows.map(row=>{
    const minutes=Math.max(0,Math.floor(Number(row.segundos)/60));
    return {...row,origem_tipo:row.emprestimo_id<0?'QUANTIDADE':'INDIVIDUAL',situacao:row.situacao_efetiva,
      codigo:row.id?'EXT-'+String(row.id).padStart(6,'0'):null,minutos:minutes,tempo:duration(minutes),atrasado:!!row.atrasado};
  });
  return {items,total:Number(total.total),...paging,atualizado_em:now()};
}
export async function updateLoss(loanId: number, data: any, userId: number) {
  const allowed = ['EXTRAVIO_EM_APURACAO', 'LOCALIZADO', 'ENCERRADO'];
  if (!allowed.includes(data.situacao)) throw new Error('Situação inválida; devolução deve ser registrada no balcão');
  const description = text(data.descricao, 'Descrição da ocorrência', 4000);
  return withTransaction(async execute => {
    let record = await queryOne('SELECT * FROM extravios WHERE emprestimo_origem_id = ?' + lockRow, [loanId]);
    if (!record) {
      const loan = loanId > 0 ? await queryOne('SELECT * FROM emprestimos WHERE id = ?' + lockRow, [loanId])
        : await queryOne('SELECT e.*, e.retirada AS data_hora_saida FROM emprestimos_quantidade e WHERE id=? AND quantidade>devolvida' + lockRow, [-loanId]);
      if (!loan) throw new Error('Movimentação não encontrada');
      const result = await execute(`INSERT INTO extravios (emprestimo_origem_id, material_id, colaborador_id, retirada, prazo_devolucao,
        identificado_em, destino, descricao, situacao, responsavel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, loan.material_id, loan.colaborador_id, loan.data_hora_saida, loan.prazo_devolucao, now(), loan.destino, description, data.situacao, userId]);
      record = { id: result[0].id };
      if (loanId < 0) await execute('UPDATE extravios SET quantidade=? WHERE id=?', [loan.quantidade-loan.devolvida,record.id]);
    } else {
      if (record.situacao === 'DEVOLVIDO' && data.situacao !== 'ENCERRADO') throw new Error('Material já devolvido; apenas o encerramento está disponível');
      await execute('UPDATE extravios SET situacao = ?, descricao = ?, responsavel_id = ? WHERE id = ?', [data.situacao, description, userId, record.id]);
    }
    await audit(userId, data.situacao, 'extravio', record.id, { descricao: description }, execute);
    return { sucesso: true, id: record.id };
  });
}
