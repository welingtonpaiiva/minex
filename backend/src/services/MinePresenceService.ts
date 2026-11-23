import { Executor } from '../config/db';
import { instant } from '../utils/time';

function isEscapeMask(name: string, category: string) {
  const normalize = (value: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  return /^mascaras? de fuga$/.test(normalize(category)) || /^mascaras? de fuga(?:\s|$)/.test(normalize(name));
}

// Presence is derived from open accesses and outstanding escape-mask loans.
// Reading the monitor never creates access records or changes material loans.
export async function minePresence(execute: Executor, collaboratorId?: number) {
  const filter = collaboratorId ? ' AND c.id = ?' : '';
  const params = collaboratorId ? [collaboratorId] : [];
  const fields = `c.nome, c.matricula, c.cargo, c.setor, c.foto_url, c.empresa, c.turma,
    c.brigadista, c.brigada_especialidade, c.brigada_validade`;
  const accesses = await execute(`SELECT a.*, a.id AS acesso_id, ${fields}
    FROM acessos_mina a JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.saida IS NULL${filter} ORDER BY a.entrada, a.id`, params);
  const loans = await execute(`SELECT p.colaborador_id, p.entrada, p.destino, m.nome AS material_nome,
    cat.nome AS categoria_nome, ${fields}
    FROM (
      SELECT colaborador_id, material_id, data_hora_saida AS entrada, destino FROM emprestimos
      UNION ALL
      SELECT colaborador_id, material_id, retirada AS entrada, destino FROM emprestimos_quantidade
      WHERE quantidade > devolvida
    ) p JOIN materiais m ON m.id = p.material_id
    LEFT JOIN categorias cat ON cat.id = m.categoria_id
    JOIN colaboradores c ON c.id = p.colaborador_id WHERE 1=1${filter}`, params);
  const people = new Map<number, any>();
  for (const access of accesses) {
    if (!people.has(access.colaborador_id)) people.set(access.colaborador_id,
      { ...access, origem: 'ACESSO', possui_mascara_fuga: false });
  }
  for (const loan of loans) {
    if (!isEscapeMask(loan.material_nome, loan.categoria_nome)) continue;
    const current = people.get(loan.colaborador_id);
    if (current) {
      current.possui_mascara_fuga = true;
      if (current.origem === 'MASCARA_FUGA' && instant(loan.entrada) < instant(current.entrada)) {
        current.entrada = loan.entrada;
        current.destino = loan.destino;
      }
    } else {
      const { material_nome, categoria_nome, ...person } = loan;
      people.set(loan.colaborador_id, { ...person, id: -loan.colaborador_id, acesso_id: -loan.colaborador_id,
        origem: 'MASCARA_FUGA', possui_mascara_fuga: true });
    }
  }
  return [...people.values()].sort((a, b) => (instant(a.entrada) - instant(b.entrada)) || a.colaborador_id - b.colaborador_id);
}
