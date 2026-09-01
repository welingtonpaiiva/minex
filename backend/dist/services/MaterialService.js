"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialService = void 0;
const db_1 = require("../config/db");
class MaterialService {
    static async listar(filtros) {
        let sql = `
      SELECT m.*, c.nome as categoria_nome,
             e.colaborador_id, col.nome as colaborador_nome, col.matricula as colaborador_matricula,
             e.data_hora_saida
      FROM materiais m
      LEFT JOIN categorias c ON m.categoria_id = c.id
      LEFT JOIN emprestimos e ON m.id = e.material_id
      LEFT JOIN colaboradores col ON e.colaborador_id = col.id
      WHERE 1=1
    `;
        const params = [];
        if (filtros?.status) {
            sql += ' AND m.status = ?';
            params.push(filtros.status);
        }
        if (filtros?.categoria_id) {
            sql += ' AND m.categoria_id = ?';
            params.push(filtros.categoria_id);
        }
        if (filtros?.busca) {
            sql += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR m.codigo_barras LIKE ? OR m.patrimonio LIKE ?)';
            const term = `%${filtros.busca.trim()}%`;
            params.push(term, term, term, term);
        }
        sql += ' ORDER BY m.codigo_interno ASC';
        return await (0, db_1.query)(sql, params);
    }
    static async buscarPorCodigo(codigo) {
        if (!codigo)
            return null;
        const cleanCode = codigo.trim();
        return await (0, db_1.queryOne)(`
      SELECT m.*, c.nome as categoria_nome,
             e.colaborador_id, col.nome as colaborador_nome, col.matricula as colaborador_matricula,
             e.data_hora_saida
      FROM materiais m
      LEFT JOIN categorias c ON m.categoria_id = c.id
      LEFT JOIN emprestimos e ON m.id = e.material_id
      LEFT JOIN colaboradores col ON e.colaborador_id = col.id
      WHERE m.codigo_barras = ? OR m.codigo_interno = ?
    `, [cleanCode, cleanCode]);
    }
    static async buscarPorId(id) {
        return await (0, db_1.queryOne)(`
      SELECT m.*, c.nome as categoria_nome,
             e.colaborador_id, col.nome as colaborador_nome, col.matricula as colaborador_matricula,
             e.data_hora_saida
      FROM materiais m
      LEFT JOIN categorias c ON m.categoria_id = c.id
      LEFT JOIN emprestimos e ON m.id = e.material_id
      LEFT JOIN colaboradores col ON e.colaborador_id = col.id
      WHERE m.id = ?
    `, [id]);
    }
    static async criar(dados) {
        if (!dados.nome || !dados.codigo_interno) {
            throw new Error('Nome e código interno são obrigatórios');
        }
        const codInt = dados.codigo_interno.trim();
        const codBar = (dados.codigo_barras || dados.codigo_interno).trim();
        const existInt = await (0, db_1.queryOne)('SELECT id FROM materiais WHERE codigo_interno = ?', [codInt]);
        if (existInt) {
            throw new Error(`Já existe um material cadastrado com o código interno ${codInt}`);
        }
        const existBar = await (0, db_1.queryOne)('SELECT id FROM materiais WHERE codigo_barras = ?', [codBar]);
        if (existBar) {
            throw new Error(`Já existe um material cadastrado com o código de barras ${codBar}`);
        }
        await (0, db_1.query)(`INSERT INTO materiais (nome, codigo_interno, codigo_barras, categoria_id, patrimonio, foto_url, status, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            dados.nome.trim(),
            codInt,
            codBar,
            dados.categoria_id || null,
            dados.patrimonio || '',
            dados.foto_url || '',
            'DISPONIVEL',
            dados.observacao || ''
        ]);
        return await this.buscarPorCodigo(codInt);
    }
    static async editar(id, dados) {
        const mat = await this.buscarPorId(id);
        if (!mat) {
            throw new Error('Material não encontrado');
        }
        await (0, db_1.query)(`UPDATE materiais
       SET nome = ?, categoria_id = ?, patrimonio = ?, foto_url = ?, observacao = ?, status = ?, updated_at = (datetime('now', 'localtime'))
       WHERE id = ?`, [
            dados.nome !== undefined ? dados.nome.trim() : mat.nome,
            dados.categoria_id !== undefined ? dados.categoria_id : mat.categoria_id,
            dados.patrimonio !== undefined ? dados.patrimonio : mat.patrimonio,
            dados.foto_url !== undefined ? dados.foto_url : mat.foto_url,
            dados.observacao !== undefined ? dados.observacao : mat.observacao,
            dados.status !== undefined ? dados.status : mat.status,
            id
        ]);
        return await this.buscarPorId(id);
    }
    static async alterarStatus(id, novoStatus, observacao, operadorId) {
        const mat = await this.buscarPorId(id);
        if (!mat)
            throw new Error('Material não encontrado');
        if (mat.status === 'EM_USO' && novoStatus === 'MANUTENCAO') {
            throw new Error('Não é possível colocar em manutenção um material que está atualmente em uso por um colaborador.');
        }
        await (0, db_1.query)(`UPDATE materiais SET status = ?, observacao = ?, updated_at = (datetime('now', 'localtime')) WHERE id = ?`, [novoStatus, observacao || mat.observacao, id]);
        // Se mudou para MANUTENCAO, registrar movimentação
        if (novoStatus === 'MANUTENCAO') {
            await (0, db_1.query)(`INSERT INTO movimentacoes (material_id, material_codigo, material_nome, colaborador_id, colaborador_nome, colaborador_matricula, operador_id, operador_nome, tipo, observacao)
         VALUES (?, ?, ?, NULL, 'N/A', 'N/A', ?, 'OPERADOR', 'MANUTENCAO', ?)`, [mat.id, mat.codigo_interno, mat.nome, operadorId || 1, observacao || 'Enviado para manutenção']);
        }
        return await this.buscarPorId(id);
    }
    static async listarCategorias() {
        return await (0, db_1.query)('SELECT * FROM categorias ORDER BY nome ASC');
    }
}
exports.MaterialService = MaterialService;
