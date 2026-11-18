import { createHash } from 'crypto';
import { lockRow, query, queryOne, withTransaction } from '../config/db';
import { audit, id, text } from './OperationalService';
import { MaterialService } from './MaterialService';
import { EmprestimoService } from './EmprestimoService';
import { quantityMove } from './QuantityService';
import { now } from '../utils/time';

const version = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const loanVersion = (material: any, loan: any) => version([material.id, material.codigo_interno, material.codigo_barras,
  loan.id, loan.colaborador_id, loan.quantidade ?? 1, loan.devolvida ?? 0, loan.retirada || loan.data_hora_saida]);
const conferenceVersion = (material: any) => version([material.id, material.codigo_interno, material.codigo_barras,
  material.status, material.updated_at, material.saldo_conferencia]);

export async function codeReturnPreview(reading: unknown) {
  const code = text(reading, 'Código do material');
  const material = await queryOne('SELECT * FROM materiais WHERE codigo_interno = ? OR codigo_barras = ?', [code, code]);
  if (!material) throw new Error('Material não cadastrado para este código.');
  const quantitative = material.tipo_controle === 'QUANTIDADE';
  const loans = await query(`SELECT e.*, c.nome, c.matricula, c.setor, c.foto_url FROM ${quantitative ? 'emprestimos_quantidade' : 'emprestimos'} e
    JOIN colaboradores c ON c.id=e.colaborador_id WHERE e.material_id=? ${quantitative ? 'AND e.quantidade>e.devolvida' : ''} ORDER BY e.id`, [material.id]);
  const conference = quantitative ? Number(material.saldo_conferencia) : material.status === 'AGUARDANDO_CONFERENCIA' ? 1 : 0;
  return { codigo: code, material: { id: material.id, nome: material.nome, codigo_interno: material.codigo_interno,
    codigo_barras: material.codigo_barras, foto_url: material.foto_url, patrimonio: material.patrimonio, status: material.status, tipo_controle: material.tipo_controle },
    emprestimos: loans.map(loan => ({ id: loan.id, quantidade: quantitative ? Number(loan.quantidade) - Number(loan.devolvida) : 1,
      retirada: loan.retirada || loan.data_hora_saida, versao: loanVersion(material, loan),
      colaborador: { id: loan.colaborador_id, nome: loan.nome, matricula: loan.matricula, setor: loan.setor, foto_url: loan.foto_url } })),
    conferencia: conference ? { quantidade: conference, versao: conferenceVersion(material) } : null };
}

export async function returnByCode(data: any, userId: number) {
  const operator = id(userId), code = text(data.codigo, 'Código do material');
  const key = text(data.requestId, 'Identificador da operação', 100), expected = text(data.versao, 'Prévia do material', 64);
  if (data.confirmar !== true) throw new Error('Confira o material recebido e confirme a operação.');
  if (!['DEVOLUCAO', 'CONFERENCIA'].includes(data.acao)) throw new Error('Operação por código inválida');
  const loanId = data.acao === 'DEVOLUCAO' ? id(data.emprestimoId) : null;
  const quantity = Number(data.quantidade), condition = data.condicao || 'APTO';
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error('Quantidade de devolução inválida');
  if (!['APTO', 'CONFERENCIA', 'DANIFICADO'].includes(condition) || (data.acao === 'CONFERENCIA' && condition !== 'APTO')) {
    throw new Error('Condição de devolução inválida');
  }
  const reason = data.acao === 'CONFERENCIA' ? text(data.justificativa, 'Justificativa', 4000) : '';
  const signature = version({ tipo: 'ENTRADA_POR_CODIGO', code, action: data.acao, loanId, quantity, condition, reason, expected });
  return withTransaction(async execute => {
    await execute('SELECT id FROM usuarios WHERE id=?' + lockRow, [operator]);
    const previous = await queryOne('SELECT * FROM requisicoes WHERE usuario_id=? AND chave=?' + lockRow, [operator, key]);
    if (previous) {
      if (previous.assinatura !== signature) throw new Error('Identificador já utilizado em outra operação');
      return JSON.parse(previous.resposta_json);
    }
    // Quantidades usam a mesma ordem de bloqueio da operação já existente: empréstimo antes do material.
    const candidate = await queryOne('SELECT tipo_controle FROM materiais WHERE codigo_interno=? OR codigo_barras=?', [code, code]);
    const quantitativeLoan = loanId && candidate?.tipo_controle === 'QUANTIDADE'
      ? await queryOne('SELECT * FROM emprestimos_quantidade WHERE id=?' + lockRow, [loanId]) : null;
    const material = await queryOne('SELECT * FROM materiais WHERE codigo_interno=? OR codigo_barras=?' + lockRow, [code, code]);
    if (!material) throw new Error('Material não cadastrado para este código.');
    const quantitative = material.tipo_controle === 'QUANTIDADE';
    const nestedKey = 'codigo-' + version([key, data.acao]);
    let collaborator: { id: number; nome: string; matricula: string } | null = null;
    if (data.acao === 'DEVOLUCAO') {
      const loan = quantitative ? quantitativeLoan : await queryOne('SELECT * FROM emprestimos WHERE id=?' + lockRow, [loanId]);
      if (!loan || loan.material_id !== material.id || loanVersion(material, loan) !== expected) {
        throw new Error('A retirada mudou ou já foi devolvida. Consulte o código novamente.');
      }
      if ((!quantitative && quantity !== 1) || (quantitative && loan.quantidade - loan.devolvida < quantity)) {
        throw new Error('Quantidade superior à pendência deste empréstimo.');
      }
      const person = await queryOne('SELECT id,nome,matricula FROM colaboradores WHERE id=?', [loan.colaborador_id]);
      if (!person) throw new Error('Responsável pela retirada não encontrado.');
      collaborator = person;
      if (quantitative) {
        await quantityMove({ tipo: 'DEVOLUCAO', emprestimo_id: loan.id, quantidade: quantity, condicao: condition, requestId: nestedKey }, operator);
      } else {
        await EmprestimoService.realizarEntrada({ colaboradorId: loan.colaborador_id, operadorId: operator,
          materiaisCodigos: [material.codigo_interno], condicao: condition, requestId: nestedKey });
      }
    } else {
      if (conferenceVersion(material) !== expected) throw new Error('A situação do material mudou. Consulte o código novamente.');
      if (quantitative) {
        await quantityMove({ tipo: 'LIBERAR', material_id: material.id, quantidade: quantity, origem: 'CONFERENCIA',
          justificativa: reason, requestId: nestedKey }, operator);
      } else {
        if (quantity !== 1) throw new Error('Informe uma unidade para equipamento individual.');
        await MaterialService.conferir(material.id, 'DISPONIVEL', reason, operator);
      }
    }
    const current = await queryOne('SELECT status FROM materiais WHERE id=?', [material.id]);
    const result = { sucesso: true, acao: data.acao, quantidade: quantity, condicao: condition, status: current!.status,
      material: { id: material.id, nome: material.nome, codigo_interno: material.codigo_interno }, colaborador: collaborator };
    await audit(operator, data.acao === 'DEVOLUCAO' ? 'DEVOLUCAO_POR_CODIGO' : 'LIBERACAO_POR_CODIGO', 'material', material.id,
      { codigo: code, emprestimo_id: loanId, colaborador_id: collaborator?.id, quantidade: quantity, condicao: condition,
        justificativa: reason, identificacao: 'TAG_OU_CODIGO_BARRAS' }, execute);
    await execute('INSERT INTO requisicoes (usuario_id,chave,assinatura,resposta_json,created_at) VALUES (?,?,?,?,?)',
      [operator, key, signature, JSON.stringify(result), now()]);
    return result;
  });
}
