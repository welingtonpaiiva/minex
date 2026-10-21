import { createHash } from 'crypto';
import { query, queryOne, withTransaction, lockRow } from '../config/db';
import { audit, id, text } from './OperationalService';
import { now } from '../utils/time';
function amount(value: unknown, signed = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || !number || (!signed && number < 1) || Math.abs(number) > 1000000) throw new Error('Quantidade inválida');
  return number;
}
export async function quantityMove(data: any, userId: number) {
  const key = text(data.requestId, 'Identificador da operação', 100), quantity = amount(data.quantidade, data.tipo === 'AJUSTE');
  const signature = createHash('sha256').update(JSON.stringify({ ...data, requestId: undefined })).digest('hex');
  return withTransaction(async execute => {
    await execute('SELECT id FROM usuarios WHERE id=?' + lockRow, [userId]);
    const previous = await queryOne('SELECT * FROM requisicoes WHERE usuario_id=? AND chave=?', [userId, key]);
    if (previous) {
      if (previous.assinatura !== signature) throw new Error('Identificador já usado em outra operação');
      return JSON.parse(previous.resposta_json);
    }
    let loan: any;
    if (data.tipo === 'DEVOLUCAO') {
      loan = await queryOne('SELECT * FROM emprestimos_quantidade WHERE id=?' + lockRow, [id(data.emprestimo_id)]);
      if (!loan || loan.quantidade - loan.devolvida < quantity) throw new Error('Quantidade superior ao saldo deste empréstimo');
    }
    const material = await queryOne('SELECT * FROM materiais WHERE id=?' + lockRow, [loan ? loan.material_id : id(data.material_id)]);
    if (!material || material.tipo_controle !== 'QUANTIDADE') throw new Error('Material por quantidade não encontrado');
    let collaborator: any;
    if (data.tipo === 'RETIRADA') {
      collaborator = await queryOne("SELECT * FROM colaboradores WHERE id=? AND status='ATIVO'", [id(data.colaborador_id)]);
      if (!collaborator) throw new Error('Colaborador inexistente ou inativo');
      if (material.status !== 'DISPONIVEL' || material.saldo_disponivel < quantity) throw new Error('Quantidade indisponível para retirada');
      let deadline: string | null = null;
      if (data.prazo_devolucao) {
        const value = new Date(data.prazo_devolucao);
        if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) throw new Error('Prazo de devolução inválido');
        deadline = value.toISOString();
      }
      const result = await execute(`INSERT INTO emprestimos_quantidade (material_id,colaborador_id,quantidade,retirada,prazo_devolucao,destino,operador_id) VALUES (?,?,?,?,?,?,?)`,
        [material.id,collaborator.id,quantity,now(),deadline,text(data.destino || '', 'Destino', 255, false),userId]);
      await execute('UPDATE materiais SET saldo_disponivel=saldo_disponivel-? WHERE id=?', [quantity,material.id]);
      await audit(userId,'RETIRADA_QUANTIDADE','emprestimo_quantidade',result[0].id,{material_id:material.id,colaborador_id:collaborator.id,quantidade:quantity},execute);
    } else if (data.tipo === 'DEVOLUCAO') {
      if (!['APTO','CONFERENCIA','DANIFICADO'].includes(data.condicao)) throw new Error('Condição inválida');
      collaborator = await queryOne('SELECT * FROM colaboradores WHERE id=?', [loan.colaborador_id]);
      const column = data.condicao === 'CONFERENCIA' ? 'saldo_conferencia' : data.condicao === 'DANIFICADO' ? 'saldo_manutencao' : 'saldo_disponivel';
      await execute(`UPDATE materiais SET ${column}=${column}+? WHERE id=?`,[quantity,material.id]);
      await execute('UPDATE emprestimos_quantidade SET devolvida=devolvida+? WHERE id=?',[quantity,loan.id]);
      await audit(userId,'DEVOLUCAO_QUANTIDADE','emprestimo_quantidade',loan.id,{material_id:material.id,quantidade:quantity,condicao:data.condicao},execute);
      if (loan.devolvida + quantity === loan.quantidade) {
        const loss = await queryOne('SELECT id FROM extravios WHERE emprestimo_origem_id=?',[-loan.id]);
        if(loss){await execute("UPDATE extravios SET situacao='DEVOLVIDO' WHERE id=?",[loss.id]);await audit(userId,'DEVOLVIDO','extravio',loss.id,{quantidade:quantity},execute);}
      }
    } else if (data.tipo === 'LIBERAR') {
      const column = data.origem === 'CONFERENCIA' ? 'saldo_conferencia' : data.origem === 'MANUTENCAO' ? 'saldo_manutencao' : '';
      if (!column || material[column] < quantity) throw new Error('Saldo insuficiente na situação escolhida');
      const reason = text(data.justificativa, 'Justificativa', 4000);
      await execute(`UPDATE materiais SET ${column}=${column}-?, saldo_disponivel=saldo_disponivel+? WHERE id=?`,[quantity,quantity,material.id]);
      await audit(userId,'LIBERACAO_QUANTIDADE','material',material.id,{quantidade:quantity,origem:data.origem,justificativa:reason},execute);
    } else if (data.tipo === 'AJUSTE') {
      if (material.saldo_disponivel + quantity < 0) throw new Error('O ajuste deixaria o saldo negativo');
      const reason = text(data.justificativa, 'Justificativa', 4000);
      await execute('UPDATE materiais SET saldo_disponivel=saldo_disponivel+? WHERE id=?',[quantity,material.id]);
      await audit(userId,'AJUSTE_QUANTIDADE','material',material.id,{quantidade:quantity,justificativa:reason},execute);
    } else throw new Error('Tipo de operação inválido');
    await execute('UPDATE materiais SET updated_at=? WHERE id=?',[now(),material.id]);
    if(collaborator){
      const operator=await queryOne('SELECT nome FROM usuarios WHERE id=?',[userId]);
      await execute(`INSERT INTO movimentacoes (material_id,material_codigo,material_nome,colaborador_id,colaborador_nome,colaborador_matricula,operador_id,operador_nome,tipo,observacao)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,[material.id,material.codigo_interno,material.nome,collaborator.id,collaborator.nome,collaborator.matricula,userId,operator.nome,data.tipo==='RETIRADA'?'SAIDA':'ENTRADA',JSON.stringify({quantidade:quantity,emprestimo_id:loan?.id,condicao:data.condicao})]);
    }
    const result={sucesso:true,quantidade:quantity,material_id:material.id};
    await execute('INSERT INTO requisicoes (usuario_id,chave,assinatura,resposta_json,created_at) VALUES (?,?,?,?,?)',[userId,key,signature,JSON.stringify(result),now()]);
    return result;
  });
}
