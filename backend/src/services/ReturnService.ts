import { createHash } from 'crypto';
import { query, queryOne, withTransaction, lockRow } from '../config/db';
import { audit, id, pagination, text } from './OperationalService';
import { EmprestimoService } from './EmprestimoService';
import { quantityMove } from './QuantityService';
import { now } from '../utils/time';
import { validateReturnNfc } from './ReturnReadings';

const pending = `WITH pendencias AS (
  SELECT e.id AS emprestimo_id, e.colaborador_id, e.material_id, 'INDIVIDUAL' AS tipo,
    m.nome AS material_nome, m.codigo_interno, m.codigo_barras, e.data_hora_saida AS retirada,
    1 AS quantidade, e.kit_nome, m.foto_url
  FROM emprestimos e JOIN materiais m ON m.id = e.material_id
  UNION ALL
  SELECT e.id, e.colaborador_id, e.material_id, 'QUANTIDADE', m.nome, m.codigo_interno, m.codigo_barras,
    e.retirada, e.quantidade - e.devolvida, NULL, m.foto_url
  FROM emprestimos_quantidade e JOIN materiais m ON m.id = e.material_id
  WHERE e.quantidade > e.devolvida
)`;

export async function pendingReturns(filters: any) {
  const p = pagination(filters), term = '%' + String(filters.busca || '').trim().slice(0, 255) + '%';
  const collaboratorId = filters.colaboradorId === undefined ? null : id(filters.colaboradorId);
  const people = `, pessoas AS (
    SELECT c.id, c.nome, c.matricula, c.setor, c.cargo, c.foto_url, c.status,
      MIN(p.retirada) AS primeira_retirada, COUNT(*) AS total_itens, SUM(p.quantidade) AS total_unidades
    FROM colaboradores c JOIN pendencias p ON p.colaborador_id = c.id
    WHERE (? IS NULL OR c.id = ?) AND (c.nome LIKE ? OR c.matricula LIKE ? OR c.setor LIKE ? OR EXISTS (
      SELECT 1 FROM pendencias busca WHERE busca.colaborador_id = c.id
      AND (busca.material_nome LIKE ? OR busca.codigo_interno LIKE ? OR busca.codigo_barras LIKE ? OR busca.kit_nome LIKE ?)
    ))
    GROUP BY c.id, c.nome, c.matricula, c.setor, c.cargo, c.foto_url, c.status
  )`;
  const params = [collaboratorId, collaboratorId, ...Array(7).fill(term)];
  const totals = await queryOne(pending + people + ` SELECT COUNT(*) AS pessoas,
    COALESCE(SUM(total_itens), 0) AS itens, COALESCE(SUM(total_unidades), 0) AS unidades FROM pessoas`, params);
  const rows = await query(pending + people + ' SELECT * FROM pessoas ORDER BY primeira_retirada, nome, id LIMIT ? OFFSET ?',
    [...params, p.limit, p.offset]);
  const items = rows.length ? await query(pending + ` SELECT * FROM pendencias WHERE colaborador_id IN (${rows.map(() => '?').join(',')})
    ORDER BY retirada, material_id, emprestimo_id`, rows.map(row => row.id)) : [];
  return {
    items: rows.map(row => ({ ...row, total_itens: Number(row.total_itens), total_unidades: Number(row.total_unidades),
      materiais: items.filter(item => item.colaborador_id === row.id).map(item => ({ ...item, quantidade: Number(item.quantidade) })) })),
    total: Number(totals.pessoas), resumo: { pessoas: Number(totals.pessoas), itens: Number(totals.itens), unidades: Number(totals.unidades) },
    ...p
  };
}

export async function quickReturn(data: any, userId: number) {
  const collaboratorId = id(data.colaboradorId), operatorId = id(userId);
  const key = text(data.requestId, 'Identificador da operação', 100), condition = data.condicao || 'APTO';
  const nfcId = text(data.nfcId, 'Leitura do crachá NFC');
  if (!['APTO', 'CONFERENCIA', 'DANIFICADO'].includes(condition)) throw new Error('Condição de devolução inválida');
  if (!Array.isArray(data.itens) || !data.itens.length || data.itens.length > 1000) throw new Error('Selecione de 1 a 1000 itens para devolução');
  const items = (data.itens as any[]).map((item: any) => {
    if (!item || !['INDIVIDUAL', 'QUANTIDADE'].includes(item.tipo)) throw new Error('Tipo de material inválido');
    const quantity = Number(item.quantidade);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000 || (item.tipo === 'INDIVIDUAL' && quantity !== 1)) {
      throw new Error('Quantidade de devolução inválida');
    }
    return { tipo: item.tipo as 'INDIVIDUAL' | 'QUANTIDADE', emprestimoId: id(item.emprestimoId), quantidade: quantity };
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.emprestimoId - b.emprestimoId);
  if (new Set(items.map(item => item.tipo + ':' + item.emprestimoId)).size !== items.length) throw new Error('Há empréstimos repetidos na devolução');
  const signature = createHash('sha256').update(JSON.stringify({ tipo: 'ENTRADA_RAPIDA', collaboratorId, condition, items, nfcId })).digest('hex');

  return withTransaction(async execute => {
    await execute('SELECT id FROM usuarios WHERE id = ?' + lockRow, [operatorId]);
    const previous = await queryOne('SELECT * FROM requisicoes WHERE usuario_id = ? AND chave = ?', [operatorId, key]);
    if (previous) {
      if (previous.assinatura !== signature) throw new Error('Identificador já utilizado em outra operação');
      return JSON.parse(previous.resposta_json);
    }
    const person = await queryOne('SELECT * FROM colaboradores WHERE id = ?' + lockRow, [collaboratorId]);
    if (!person) throw new Error('Colaborador não encontrado');
    await validateReturnNfc(collaboratorId, nfcId);

    const codes: string[] = [];
    for (const item of items) {
      if (item.tipo === 'INDIVIDUAL') {
        // Conferir o empréstimo original impede dar baixa em uma retirada posterior do mesmo material.
        const loan = await queryOne(`SELECT e.id, e.material_id, m.codigo_interno FROM emprestimos e
          JOIN materiais m ON m.id = e.material_id WHERE e.id = ? AND e.colaborador_id = ?` + lockRow,
          [item.emprestimoId, collaboratorId]);
        if (!loan) throw new Error('Um dos materiais já foi devolvido ou mudou de responsável. Atualize a lista e confira novamente.');
        codes.push(loan.codigo_interno);
      } else {
        const loan = await queryOne('SELECT * FROM emprestimos_quantidade WHERE id = ? AND colaborador_id = ?' + lockRow,
          [item.emprestimoId, collaboratorId]);
        if (!loan || loan.quantidade - loan.devolvida < item.quantidade) {
          throw new Error('A quantidade pendente mudou. Atualize a lista e confira os itens recebidos.');
        }
      }
    }

    let step = 0;
    const nextKey = () => 'baixa-' + createHash('sha256').update(JSON.stringify([key, step++])).digest('hex');
    for (let start = 0; start < codes.length; start += 100) {
      await EmprestimoService.realizarEntrada({ colaboradorId: collaboratorId, operadorId: operatorId,
        materiaisCodigos: codes.slice(start, start + 100), condicao: condition, requestId: nextKey() });
    }
    for (const item of items.filter(item => item.tipo === 'QUANTIDADE')) {
      await quantityMove({ tipo: 'DEVOLUCAO', emprestimo_id: item.emprestimoId,
        quantidade: item.quantidade, condicao: condition, requestId: nextKey() }, operatorId);
    }
    const result = { sucesso: true, colaborador: { id: person.id, nome: person.nome },
      materiaisCount: items.length, unidadesCount: items.reduce((sum, item) => sum + item.quantidade, 0) };
    await audit(operatorId, 'DEVOLUCAO_RAPIDA', 'colaborador', collaboratorId, { itens: items, condicao: condition }, execute);
    await execute('INSERT INTO requisicoes (usuario_id, chave, assinatura, resposta_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [operatorId, key, signature, JSON.stringify(result), now()]);
    return result;
  });
}
