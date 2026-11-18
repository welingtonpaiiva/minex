"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeReturnPreview = codeReturnPreview;
exports.returnByCode = returnByCode;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const OperationalService_1 = require("./OperationalService");
const MaterialService_1 = require("./MaterialService");
const EmprestimoService_1 = require("./EmprestimoService");
const QuantityService_1 = require("./QuantityService");
const time_1 = require("../utils/time");
const version = (value) => (0, crypto_1.createHash)('sha256').update(JSON.stringify(value)).digest('hex');
const loanVersion = (material, loan) => version([material.id, material.codigo_interno, material.codigo_barras,
    loan.id, loan.colaborador_id, loan.quantidade ?? 1, loan.devolvida ?? 0, loan.retirada || loan.data_hora_saida]);
const conferenceVersion = (material) => version([material.id, material.codigo_interno, material.codigo_barras,
    material.status, material.updated_at, material.saldo_conferencia]);
async function codeReturnPreview(reading) {
    const code = (0, OperationalService_1.text)(reading, 'Código do material');
    const material = await (0, db_1.queryOne)('SELECT * FROM materiais WHERE codigo_interno = ? OR codigo_barras = ?', [code, code]);
    if (!material)
        throw new Error('Material não cadastrado para este código.');
    const quantitative = material.tipo_controle === 'QUANTIDADE';
    const loans = await (0, db_1.query)(`SELECT e.*, c.nome, c.matricula, c.setor, c.foto_url FROM ${quantitative ? 'emprestimos_quantidade' : 'emprestimos'} e
    JOIN colaboradores c ON c.id=e.colaborador_id WHERE e.material_id=? ${quantitative ? 'AND e.quantidade>e.devolvida' : ''} ORDER BY e.id`, [material.id]);
    const conference = quantitative ? Number(material.saldo_conferencia) : material.status === 'AGUARDANDO_CONFERENCIA' ? 1 : 0;
    return { codigo: code, material: { id: material.id, nome: material.nome, codigo_interno: material.codigo_interno,
            codigo_barras: material.codigo_barras, foto_url: material.foto_url, patrimonio: material.patrimonio, status: material.status, tipo_controle: material.tipo_controle },
        emprestimos: loans.map(loan => ({ id: loan.id, quantidade: quantitative ? Number(loan.quantidade) - Number(loan.devolvida) : 1,
            retirada: loan.retirada || loan.data_hora_saida, versao: loanVersion(material, loan),
            colaborador: { id: loan.colaborador_id, nome: loan.nome, matricula: loan.matricula, setor: loan.setor, foto_url: loan.foto_url } })),
        conferencia: conference ? { quantidade: conference, versao: conferenceVersion(material) } : null };
}
async function returnByCode(data, userId) {
    const operator = (0, OperationalService_1.id)(userId), code = (0, OperationalService_1.text)(data.codigo, 'Código do material');
    const key = (0, OperationalService_1.text)(data.requestId, 'Identificador da operação', 100), expected = (0, OperationalService_1.text)(data.versao, 'Prévia do material', 64);
    if (data.confirmar !== true)
        throw new Error('Confira o material recebido e confirme a operação.');
    if (!['DEVOLUCAO', 'CONFERENCIA'].includes(data.acao))
        throw new Error('Operação por código inválida');
    const loanId = data.acao === 'DEVOLUCAO' ? (0, OperationalService_1.id)(data.emprestimoId) : null;
    const quantity = Number(data.quantidade), condition = data.condicao || 'APTO';
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000)
        throw new Error('Quantidade de devolução inválida');
    if (!['APTO', 'CONFERENCIA', 'DANIFICADO'].includes(condition) || (data.acao === 'CONFERENCIA' && condition !== 'APTO')) {
        throw new Error('Condição de devolução inválida');
    }
    const reason = data.acao === 'CONFERENCIA' ? (0, OperationalService_1.text)(data.justificativa, 'Justificativa', 4000) : '';
    const signature = version({ tipo: 'ENTRADA_POR_CODIGO', code, action: data.acao, loanId, quantity, condition, reason, expected });
    return (0, db_1.withTransaction)(async (execute) => {
        await execute('SELECT id FROM usuarios WHERE id=?' + db_1.lockRow, [operator]);
        const previous = await (0, db_1.queryOne)('SELECT * FROM requisicoes WHERE usuario_id=? AND chave=?' + db_1.lockRow, [operator, key]);
        if (previous) {
            if (previous.assinatura !== signature)
                throw new Error('Identificador já utilizado em outra operação');
            return JSON.parse(previous.resposta_json);
        }
        // Quantidades usam a mesma ordem de bloqueio da operação já existente: empréstimo antes do material.
        const candidate = await (0, db_1.queryOne)('SELECT tipo_controle FROM materiais WHERE codigo_interno=? OR codigo_barras=?', [code, code]);
        const quantitativeLoan = loanId && candidate?.tipo_controle === 'QUANTIDADE'
            ? await (0, db_1.queryOne)('SELECT * FROM emprestimos_quantidade WHERE id=?' + db_1.lockRow, [loanId]) : null;
        const material = await (0, db_1.queryOne)('SELECT * FROM materiais WHERE codigo_interno=? OR codigo_barras=?' + db_1.lockRow, [code, code]);
        if (!material)
            throw new Error('Material não cadastrado para este código.');
        const quantitative = material.tipo_controle === 'QUANTIDADE';
        const nestedKey = 'codigo-' + version([key, data.acao]);
        let collaborator = null;
        if (data.acao === 'DEVOLUCAO') {
            const loan = quantitative ? quantitativeLoan : await (0, db_1.queryOne)('SELECT * FROM emprestimos WHERE id=?' + db_1.lockRow, [loanId]);
            if (!loan || loan.material_id !== material.id || loanVersion(material, loan) !== expected) {
                throw new Error('A retirada mudou ou já foi devolvida. Consulte o código novamente.');
            }
            if ((!quantitative && quantity !== 1) || (quantitative && loan.quantidade - loan.devolvida < quantity)) {
                throw new Error('Quantidade superior à pendência deste empréstimo.');
            }
            const person = await (0, db_1.queryOne)('SELECT id,nome,matricula FROM colaboradores WHERE id=?', [loan.colaborador_id]);
            if (!person)
                throw new Error('Responsável pela retirada não encontrado.');
            collaborator = person;
            if (quantitative) {
                await (0, QuantityService_1.quantityMove)({ tipo: 'DEVOLUCAO', emprestimo_id: loan.id, quantidade: quantity, condicao: condition, requestId: nestedKey }, operator);
            }
            else {
                await EmprestimoService_1.EmprestimoService.realizarEntrada({ colaboradorId: loan.colaborador_id, operadorId: operator,
                    materiaisCodigos: [material.codigo_interno], condicao: condition, requestId: nestedKey });
            }
        }
        else {
            if (conferenceVersion(material) !== expected)
                throw new Error('A situação do material mudou. Consulte o código novamente.');
            if (quantitative) {
                await (0, QuantityService_1.quantityMove)({ tipo: 'LIBERAR', material_id: material.id, quantidade: quantity, origem: 'CONFERENCIA',
                    justificativa: reason, requestId: nestedKey }, operator);
            }
            else {
                if (quantity !== 1)
                    throw new Error('Informe uma unidade para equipamento individual.');
                await MaterialService_1.MaterialService.conferir(material.id, 'DISPONIVEL', reason, operator);
            }
        }
        const current = await (0, db_1.queryOne)('SELECT status FROM materiais WHERE id=?', [material.id]);
        const result = { sucesso: true, acao: data.acao, quantidade: quantity, condicao: condition, status: current.status,
            material: { id: material.id, nome: material.nome, codigo_interno: material.codigo_interno }, colaborador: collaborator };
        await (0, OperationalService_1.audit)(operator, data.acao === 'DEVOLUCAO' ? 'DEVOLUCAO_POR_CODIGO' : 'LIBERACAO_POR_CODIGO', 'material', material.id, { codigo: code, emprestimo_id: loanId, colaborador_id: collaborator?.id, quantidade: quantity, condicao: condition,
            justificativa: reason, identificacao: 'TAG_OU_CODIGO_BARRAS' }, execute);
        await execute('INSERT INTO requisicoes (usuario_id,chave,assinatura,resposta_json,created_at) VALUES (?,?,?,?,?)', [operator, key, signature, JSON.stringify(result), (0, time_1.now)()]);
        return result;
    });
}
