"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmprestimoService = void 0;
const db_1 = require("../config/db");
class EmprestimoService {
    /**
     * Buscar todos os materiais atualmente em uso por um colaborador específico
     */
    static async buscarEmprestimosDoColaborador(colaboradorId) {
        return await (0, db_1.query)(`
      SELECT e.id as emprestimo_id, e.data_hora_saida,
             m.id as material_id, m.nome as material_nome, m.codigo_interno, m.codigo_barras, m.patrimonio,
             c.nome as categoria_nome
      FROM emprestimos e
      JOIN materiais m ON e.material_id = m.id
      LEFT JOIN categorias c ON m.categoria_id = c.id
      WHERE e.colaborador_id = ?
      ORDER BY m.codigo_interno ASC
    `, [colaboradorId]);
    }
    /**
     * Buscar todos os empréstimos ativos no sistema ("QUEM ESTÁ COM QUAL MATERIAL?")
     */
    static async buscarEmprestimosAtivos(busca) {
        let sql = `
      SELECT e.id as emprestimo_id, e.data_hora_saida,
             col.id as colaborador_id, col.nome as colaborador_nome, col.matricula as colaborador_matricula, col.setor, col.cargo,
             m.id as material_id, m.nome as material_nome, m.codigo_interno, m.codigo_barras, m.patrimonio,
             u.nome as operador_saida_nome
      FROM emprestimos e
      JOIN colaboradores col ON e.colaborador_id = col.id
      JOIN materiais m ON e.material_id = m.id
      LEFT JOIN usuarios u ON e.operador_saida_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (busca) {
            sql += ' AND (col.nome LIKE ? OR col.matricula LIKE ? OR m.nome LIKE ? OR m.codigo_interno LIKE ?)';
            const term = `%${busca.trim()}%`;
            params.push(term, term, term, term);
        }
        sql += ' ORDER BY e.data_hora_saida DESC';
        return await (0, db_1.query)(sql, params);
    }
    /**
     * REGISTRAR SAÍDA DE MATERIAIS (TRANSAÇÃO ATÔMICA + CONCORRÊNCIA)
     */
    static async realizarSaida(dados) {
        const { colaboradorId, materiaisCodigos, operadorId } = dados;
        if (!colaboradorId)
            throw new Error('Colaborador não identificado');
        if (!materiaisCodigos || materiaisCodigos.length === 0) {
            throw new Error('Nenhum material informado para saída');
        }
        // Executar transação atômica
        return await (0, db_1.withTransaction)(async (execQuery) => {
            // 1. Validar colaborador
            const colabRows = await execQuery('SELECT * FROM colaboradores WHERE id = ?', [colaboradorId]);
            const colaborador = colabRows[0];
            if (!colaborador)
                throw new Error('Colaborador não encontrado');
            if (colaborador.status !== 'ATIVO') {
                throw new Error(`COLABORADOR INATIVO (${colaborador.nome}). Não é possível realizar saída.`);
            }
            // 2. Validar operador
            const opRows = await execQuery('SELECT * FROM usuarios WHERE id = ?', [operadorId]);
            const operador = opRows[0] || { nome: dados.operadorNome || 'OPERADOR' };
            const materiaisProcessados = [];
            // 3. Processar cada material
            for (const cod of materiaisCodigos) {
                const cleanCod = cod.trim();
                const matRows = await execQuery('SELECT * FROM materiais WHERE codigo_barras = ? OR codigo_interno = ?', [cleanCod, cleanCod]);
                const mat = matRows[0];
                if (!mat) {
                    throw new Error(`MATERIAL NÃO CADASTRADO: ${cleanCod}`);
                }
                // Validação de Concorrência & Status
                if (mat.status === 'EM_USO') {
                    // Buscar quem está com o material
                    const empRows = await execQuery(`SELECT e.data_hora_saida, col.nome as colaborador_nome
             FROM emprestimos e
             JOIN colaboradores col ON e.colaborador_id = col.id
             WHERE e.material_id = ?`, [mat.id]);
                    const emp = empRows[0];
                    const resp = emp ? emp.colaborador_nome : 'Outro colaborador';
                    throw new Error(`MATERIAL JÁ ESTÁ EM USO (${mat.codigo_interno} - ${mat.nome}) por ${resp}`);
                }
                if (mat.status === 'MANUTENCAO') {
                    throw new Error(`MATERIAL EM MANUTENÇÃO (${mat.codigo_interno} - ${mat.nome}). Não pode ser entregue.`);
                }
                if (mat.status !== 'DISPONIVEL') {
                    throw new Error(`MATERIAL FOI UTILIZADO EM OUTRA OPERAÇÃO: ${mat.codigo_interno}`);
                }
                // Trava adicional: Verificar se já existe registro em emprestimos
                const activeLoanRows = await execQuery('SELECT id FROM emprestimos WHERE material_id = ?', [mat.id]);
                if (activeLoanRows.length > 0) {
                    throw new Error(`MATERIAL FOI UTILIZADO EM OUTRA OPERAÇÃO: ${mat.codigo_interno}`);
                }
                // Atualizar status do material para EM_USO
                await execQuery("UPDATE materiais SET status = 'EM_USO', updated_at = (datetime('now', 'localtime')) WHERE id = ?", [mat.id]);
                // Criar empréstimo ativo (Garantia UNIQUE no material_id)
                await execQuery(`INSERT INTO emprestimos (colaborador_id, material_id, operador_saida_id, data_hora_saida)
           VALUES (?, ?, ?, (datetime('now', 'localtime')))`, [colaborador.id, mat.id, operadorId]);
                // Criar registro permanente de histórico
                await execQuery(`INSERT INTO movimentacoes (material_id, material_codigo, material_nome, colaborador_id, colaborador_nome, colaborador_matricula, operador_id, operador_nome, tipo, observacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SAIDA', 'Saída registrada no balcão')`, [
                    mat.id,
                    mat.codigo_interno,
                    mat.nome,
                    colaborador.id,
                    colaborador.nome,
                    colaborador.matricula,
                    operadorId,
                    operador.nome
                ]);
                materiaisProcessados.push({
                    id: mat.id,
                    codigo_interno: mat.codigo_interno,
                    nome: mat.nome
                });
            }
            return {
                sucesso: true,
                mensagem: 'SAÍDA REGISTRADA COM SUCESSO',
                colaborador: {
                    id: colaborador.id,
                    nome: colaborador.nome,
                    matricula: colaborador.matricula,
                    setor: colaborador.setor,
                    cargo: colaborador.cargo
                },
                materiaisCount: materiaisProcessados.length,
                materiais: materiaisProcessados,
                dataHora: new Date().toISOString()
            };
        });
    }
    /**
     * REGISTRAR ENTRADA / DEVOLUÇÃO DE MATERIAIS (TRANSAÇÃO ATÔMICA + DEVOLUÇÃO PARCIAL)
     */
    static async realizarEntrada(dados) {
        const { colaboradorId, materiaisCodigos, operadorId } = dados;
        if (!colaboradorId)
            throw new Error('Colaborador não identificado');
        if (!materiaisCodigos || materiaisCodigos.length === 0) {
            throw new Error('Nenhum material selecionado para devolução');
        }
        return await (0, db_1.withTransaction)(async (execQuery) => {
            // 1. Validar colaborador
            const colabRows = await execQuery('SELECT * FROM colaboradores WHERE id = ?', [colaboradorId]);
            const colaborador = colabRows[0];
            if (!colaborador)
                throw new Error('Colaborador não encontrado');
            // 2. Validar operador
            const opRows = await execQuery('SELECT * FROM usuarios WHERE id = ?', [operadorId]);
            const operador = opRows[0] || { nome: dados.operadorNome || 'OPERADOR' };
            const materiaisDevolvidos = [];
            // 3. Processar devoluções
            for (const cod of materiaisCodigos) {
                const cleanCod = cod.trim();
                const matRows = await execQuery('SELECT * FROM materiais WHERE codigo_barras = ? OR codigo_interno = ?', [cleanCod, cleanCod]);
                const mat = matRows[0];
                if (!mat) {
                    throw new Error(`MATERIAL NÃO CADASTRADO: ${cleanCod}`);
                }
                // Verificar se existe empréstimo ativo deste material para este colaborador
                const empRows = await execQuery('SELECT * FROM emprestimos WHERE material_id = ? AND colaborador_id = ?', [mat.id, colaborador.id]);
                const emp = empRows[0];
                if (!emp) {
                    throw new Error(`MATERIAL NÃO REGISTRADO PARA ESTE COLABORADOR (${mat.codigo_interno} - ${mat.nome}). Este material não consta nos empréstimos de ${colaborador.nome}.`);
                }
                // Atualizar status do material para DISPONIVEL
                await execQuery("UPDATE materiais SET status = 'DISPONIVEL', updated_at = (datetime('now', 'localtime')) WHERE id = ?", [mat.id]);
                // Encerrar / remover empréstimo ativo
                await execQuery('DELETE FROM emprestimos WHERE id = ?', [emp.id]);
                // Criar registro permanente de histórico (ENTRADA)
                await execQuery(`INSERT INTO movimentacoes (material_id, material_codigo, material_nome, colaborador_id, colaborador_nome, colaborador_matricula, operador_id, operador_nome, tipo, observacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ENTRADA', 'Devolução registrada no balcão')`, [
                    mat.id,
                    mat.codigo_interno,
                    mat.nome,
                    colaborador.id,
                    colaborador.nome,
                    colaborador.matricula,
                    operadorId,
                    operador.nome
                ]);
                materiaisDevolvidos.push({
                    id: mat.id,
                    codigo_interno: mat.codigo_interno,
                    nome: mat.nome
                });
            }
            return {
                sucesso: true,
                mensagem: 'ENTRADA REGISTRADA COM SUCESSO',
                colaborador: {
                    id: colaborador.id,
                    nome: colaborador.nome,
                    matricula: colaborador.matricula
                },
                materiaisCount: materiaisDevolvidos.length,
                materiais: materiaisDevolvidos,
                dataHora: new Date().toISOString()
            };
        });
    }
}
exports.EmprestimoService = EmprestimoService;
