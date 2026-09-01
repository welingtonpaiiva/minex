"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColaboradorService = void 0;
const db_1 = require("../config/db");
class ColaboradorService {
    static async listar(busca, status) {
        let sql = 'SELECT * FROM colaboradores WHERE 1=1';
        const params = [];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        if (busca) {
            sql += ' AND (nome LIKE ? OR matricula LIKE ? OR nfc_id LIKE ? OR setor LIKE ?)';
            const term = `%${busca.trim()}%`;
            params.push(term, term, term, term);
        }
        sql += ' ORDER BY nome ASC';
        return await (0, db_1.query)(sql, params);
    }
    static async buscarPorId(id) {
        return await (0, db_1.queryOne)('SELECT * FROM colaboradores WHERE id = ?', [id]);
    }
    static async buscarPorNfc(nfcId) {
        if (!nfcId)
            return null;
        return await (0, db_1.queryOne)('SELECT * FROM colaboradores WHERE nfc_id = ?', [nfcId.trim()]);
    }
    static async buscarPorMatricula(matricula) {
        if (!matricula)
            return null;
        return await (0, db_1.queryOne)('SELECT * FROM colaboradores WHERE matricula = ?', [matricula.trim()]);
    }
    static async criar(dados) {
        if (!dados.nome || !dados.matricula) {
            throw new Error('Nome e matrícula são obrigatórios');
        }
        const matExist = await (0, db_1.queryOne)('SELECT id FROM colaboradores WHERE matricula = ?', [dados.matricula.trim()]);
        if (matExist) {
            throw new Error('Já existe um colaborador cadastrado com esta matrícula');
        }
        if (dados.nfc_id && dados.nfc_id.trim() !== '') {
            const nfcExist = await (0, db_1.queryOne)('SELECT id FROM colaboradores WHERE nfc_id = ?', [dados.nfc_id.trim()]);
            if (nfcExist) {
                throw new Error('Este cartão NFC já está vinculado a outro colaborador');
            }
        }
        await (0, db_1.query)(`INSERT INTO colaboradores (nome, matricula, setor, cargo, foto_url, nfc_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            dados.nome.trim(),
            dados.matricula.trim(),
            dados.setor || '',
            dados.cargo || '',
            dados.foto_url || '',
            dados.nfc_id ? dados.nfc_id.trim() : null,
            'ATIVO'
        ]);
        return await (0, db_1.queryOne)('SELECT * FROM colaboradores WHERE matricula = ?', [dados.matricula.trim()]);
    }
    static async editar(id, dados) {
        const colab = await this.buscarPorId(id);
        if (!colab) {
            throw new Error('Colaborador não encontrado');
        }
        if (dados.nfc_id && dados.nfc_id.trim() !== colab.nfc_id) {
            const nfcExist = await (0, db_1.queryOne)('SELECT id FROM colaboradores WHERE nfc_id = ? AND id != ?', [dados.nfc_id.trim(), id]);
            if (nfcExist) {
                throw new Error('Este cartão NFC já está associado a outro colaborador');
            }
        }
        await (0, db_1.query)(`UPDATE colaboradores
       SET nome = ?, setor = ?, cargo = ?, foto_url = ?, nfc_id = ?, status = ?, updated_at = (datetime('now', 'localtime'))
       WHERE id = ?`, [
            dados.nome !== undefined ? dados.nome.trim() : colab.nome,
            dados.setor !== undefined ? dados.setor : colab.setor,
            dados.cargo !== undefined ? dados.cargo : colab.cargo,
            dados.foto_url !== undefined ? dados.foto_url : colab.foto_url,
            dados.nfc_id !== undefined ? (dados.nfc_id ? dados.nfc_id.trim() : null) : colab.nfc_id,
            dados.status !== undefined ? dados.status : colab.status,
            id
        ]);
        return await this.buscarPorId(id);
    }
    static async associarNfc(colaboradorId, nfcId) {
        if (!nfcId)
            throw new Error('Código NFC não informado');
        const cleanNfc = nfcId.trim();
        const exist = await (0, db_1.queryOne)('SELECT id FROM colaboradores WHERE nfc_id = ? AND id != ?', [cleanNfc, colaboradorId]);
        if (exist) {
            throw new Error('Este cartão NFC já pertence a outro colaborador');
        }
        await (0, db_1.query)('UPDATE colaboradores SET nfc_id = ?, updated_at = (datetime(\'now\', \'localtime\')) WHERE id = ?', [cleanNfc, colaboradorId]);
        return await this.buscarPorId(colaboradorId);
    }
}
exports.ColaboradorService = ColaboradorService;
