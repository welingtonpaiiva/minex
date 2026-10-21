"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmprestimoService = void 0;
const db_1 = require("../config/db");
const OperationalService_1 = require("./OperationalService");
const time_1 = require("../utils/time");
const crypto_1 = require("crypto");
async function operation(data, type, work) {
    (0, OperationalService_1.id)(data.colaboradorId);
    (0, OperationalService_1.id)(data.operadorId);
    if (!Array.isArray(data.materiaisCodigos) || !data.materiaisCodigos.length || data.materiaisCodigos.length > 100)
        throw new Error('Informe de 1 a 100 materiais');
    data.materiaisCodigos = data.materiaisCodigos.map((code) => (0, OperationalService_1.text)(code, 'Código do material'));
    if (new Set(data.materiaisCodigos).size !== data.materiaisCodigos.length)
        throw new Error('Há códigos repetidos na operação');
    const key = (0, OperationalService_1.text)(data.requestId, 'Identificador da operação', 100);
    const signature = (0, crypto_1.createHash)('sha256').update(JSON.stringify({ tipo: type, colaborador: data.colaboradorId, codigos: [...data.materiaisCodigos].sort(), condicao: data.condicao || 'APTO' })).digest('hex');
    return (0, db_1.withTransaction)(async (execute) => {
        // Serializes duplicate submissions for one operator across connections/processes.
        await execute('SELECT id FROM usuarios WHERE id = ?' + db_1.lockRow, [data.operadorId]);
        const previous = await (0, db_1.queryOne)('SELECT * FROM requisicoes WHERE usuario_id = ? AND chave = ?', [data.operadorId, key]);
        if (previous) {
            if (previous.assinatura !== signature)
                throw new Error('Identificador já utilizado em outra operação');
            return JSON.parse(previous.resposta_json);
        }
        const result = await work(execute);
        await execute('INSERT INTO requisicoes (usuario_id, chave, assinatura, resposta_json, created_at) VALUES (?, ?, ?, ?, ?)', [data.operadorId, key, signature, JSON.stringify(result), (0, time_1.now)()]);
        return result;
    });
}
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
        return await operation(dados, 'SAIDA', async (execQuery) => {
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
                const matRows = await execQuery('SELECT * FROM materiais WHERE codigo_barras = ? OR codigo_interno = ?' + db_1.lockRow, [cleanCod, cleanCod]);
                const mat = matRows[0];
                if (!mat) {
                    throw new Error(`MATERIAL NÃO CADASTRADO: ${cleanCod}`);
                }
                if (mat.tipo_controle === 'QUANTIDADE')
                    throw new Error('Use a operação por quantidade para este material');
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
                await (0, OperationalService_1.audit)(operadorId, 'RETIRADA', 'material', mat.id, { colaborador_id: colaborador.id, codigo: mat.codigo_interno }, execQuery);
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
        if (!['APTO', 'CONFERENCIA', 'DANIFICADO'].includes(dados.condicao || 'APTO'))
            throw new Error('Condição de devolução inválida');
        return await operation(dados, 'ENTRADA', async (execQuery) => {
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
                const matRows = await execQuery('SELECT * FROM materiais WHERE codigo_barras = ? OR codigo_interno = ?' + db_1.lockRow, [cleanCod, cleanCod]);
                const mat = matRows[0];
                if (!mat) {
                    throw new Error(`MATERIAL NÃO CADASTRADO: ${cleanCod}`);
                }
                // Verificar se existe empréstimo ativo deste material para este colaborador
                const empRows = await execQuery('SELECT * FROM emprestimos WHERE material_id = ? AND colaborador_id = ?' + db_1.lockRow, [mat.id, colaborador.id]);
                const emp = empRows[0];
                if (!emp) {
                    throw new Error(`MATERIAL NÃO REGISTRADO PARA ESTE COLABORADOR (${mat.codigo_interno} - ${mat.nome}). Este material não consta nos empréstimos de ${colaborador.nome}.`);
                }
                // Atualizar status do material para DISPONIVEL
                await execQuery("UPDATE materiais SET status = ?, updated_at = (datetime('now', 'localtime')) WHERE id = ?", [dados.condicao === 'CONFERENCIA' ? 'AGUARDANDO_CONFERENCIA' : dados.condicao === 'DANIFICADO' ? 'MANUTENCAO' : 'DISPONIVEL', mat.id]);
                // Encerrar / remover empréstimo ativo
                await execQuery('DELETE FROM emprestimos WHERE id = ?', [emp.id]);
                const loss = await (0, db_1.queryOne)('SELECT id FROM extravios WHERE emprestimo_origem_id = ?', [emp.id]);
                if (loss) {
                    await execQuery("UPDATE extravios SET situacao = 'DEVOLVIDO' WHERE id = ?", [loss.id]);
                    await (0, OperationalService_1.audit)(operadorId, 'DEVOLVIDO', 'extravio', loss.id, { material_id: mat.id }, execQuery);
                }
                await (0, OperationalService_1.audit)(operadorId, 'DEVOLUCAO', 'material', mat.id, { colaborador_id: colaborador.id, condicao: dados.condicao || 'APTO' }, execQuery);
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
    /**
     * BUSCAR ALERTAS DE TURNO (MONITORAMENTO EM TEMPO REAL DE POSSE > 8 HORAS)
     */
    static async buscarAlertasTurno() {
        const rows = await (0, db_1.query)(`
      SELECT e.id as emprestimo_id, e.data_hora_saida,
             col.id as colaborador_id, col.nome as colaborador_nome, col.matricula as colaborador_matricula, col.setor, col.cargo,
             m.id as material_id, m.nome as material_nome, m.codigo_interno, m.codigo_barras, m.patrimonio,
             c.nome as categoria_nome
      FROM emprestimos e
      JOIN colaboradores col ON e.colaborador_id = col.id
      JOIN materiais m ON e.material_id = m.id
      LEFT JOIN categorias c ON m.categoria_id = c.id
      ORDER BY e.data_hora_saida ASC
    `);
        let normalCount = 0;
        let atencaoCount = 0;
        let criticoCount = 0;
        const agora = new Date();
        const alertas = rows.map((row) => {
            // Calcular diferença em minutos
            const dataSaida = new Date((0, time_1.instant)(row.data_hora_saida));
            const diffMs = Math.max(0, agora.getTime() - dataSaida.getTime());
            const minutosEmUso = Math.floor(diffMs / (1000 * 60));
            const horasEmUso = Math.floor(minutosEmUso / 60);
            const minsRestantes = minutosEmUso % 60;
            const tempoFormatado = `${horasEmUso}h ${minsRestantes < 10 ? '0' : ''}${minsRestantes}min`;
            const isEquipamentoVital = (row.categoria_nome && row.categoria_nome.toLowerCase().includes('gás')) ||
                (row.material_nome && row.material_nome.toLowerCase().includes('detector'));
            let nivel_alerta = 'NORMAL';
            let mensagem_alerta = 'Em uso dentro do turno normal';
            if (isEquipamentoVital) {
                if (minutosEmUso >= 480) { // >= 8h00
                    nivel_alerta = 'CRITICO';
                    mensagem_alerta = 'Detector em posse há mais de oito horas; consulte o registro de acesso à mina';
                }
                else if (minutosEmUso >= 420) { // >= 7h00
                    nivel_alerta = 'ATENCAO';
                    mensagem_alerta = 'Detector Multigás próximo do fim de turno (7h+)';
                }
            }
            else {
                if (minutosEmUso >= 480) {
                    nivel_alerta = 'CRITICO';
                    mensagem_alerta = 'Material em posse há mais de oito horas; consulte o registro de acesso à mina';
                }
                else if (minutosEmUso >= 450) { // >= 7h30 (7.5h)
                    nivel_alerta = 'ATENCAO';
                    mensagem_alerta = 'Material próximo do término de turno (7h30+)';
                }
            }
            if (nivel_alerta === 'CRITICO')
                criticoCount++;
            else if (nivel_alerta === 'ATENCAO')
                atencaoCount++;
            else
                normalCount++;
            return {
                ...row,
                minutos_em_uso: minutosEmUso,
                horas_em_uso: horasEmUso,
                tempo_formatado: tempoFormatado,
                nivel_alerta,
                mensagem_alerta
            };
        });
        return {
            totalEmUso: rows.length,
            normalCount,
            atencaoCount,
            criticoCount,
            alertas
        };
    }
}
exports.EmprestimoService = EmprestimoService;
