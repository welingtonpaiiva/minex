"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColaboradorController = void 0;
const ColaboradorService_1 = require("../services/ColaboradorService");
const OperationalService_1 = require("../services/OperationalService");
const db_1 = require("../config/db");
class ColaboradorController {
    static async listar(req, res) {
        try {
            const { busca, status } = req.query;
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
            const colaboradores = await ColaboradorService_1.ColaboradorService.listar(busca, status, limit, Math.max(0, (Number(req.query.page) || 1) - 1) * limit);
            return res.json(colaboradores);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarPorNfc(req, res) {
        try {
            const { nfcId } = req.params;
            const colab = await ColaboradorService_1.ColaboradorService.buscarPorNfc(nfcId);
            if (!colab) {
                return res.status(404).json({ error: 'COLABORADOR NÃO ENCONTRADO PARA ESTE CARTÃO NFC' });
            }
            return res.json(colab);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarPorMatricula(req, res) {
        try {
            const { matricula } = req.params;
            const colab = await ColaboradorService_1.ColaboradorService.buscarPorMatricula(matricula);
            if (!colab) {
                return res.status(404).json({ error: 'COLABORADOR NÃO ENCONTRADO PARA ESTA MATRÍCULA' });
            }
            return res.json(colab);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarPorId(req, res) {
        try {
            const id = parseInt(req.params.id);
            const colab = await ColaboradorService_1.ColaboradorService.buscarPorId(id);
            if (!colab)
                return res.status(404).json({ error: 'Colaborador não encontrado' });
            return res.json(colab);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async criar(req, res) {
        try {
            (0, OperationalService_1.text)(req.body.nome, 'Nome');
            (0, OperationalService_1.text)(req.body.matricula, 'Matrícula');
            for (const field of ['setor', 'cargo', 'nfc_id'])
                if (req.body[field] != null)
                    (0, OperationalService_1.text)(req.body[field], field, 255, false);
            const novo = await (0, db_1.withTransaction)(async (execute) => {
                await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + db_1.lockRow);
                const result = await ColaboradorService_1.ColaboradorService.criar({ ...req.body, foto_url: '' });
                await (0, OperationalService_1.audit)(req.user.id, 'CRIAR', 'colaborador', result.id, { nome: result.nome, matricula: result.matricula }, execute);
                return result;
            });
            return res.status(201).json(novo);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async editar(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (req.body.nome !== undefined)
                (0, OperationalService_1.text)(req.body.nome, 'Nome');
            for (const field of ['setor', 'cargo', 'nfc_id'])
                if (req.body[field] != null)
                    (0, OperationalService_1.text)(req.body[field], field, 255, false);
            if (req.body.status !== undefined && !['ATIVO', 'INATIVO'].includes(req.body.status))
                throw new Error('Situação inválida');
            const atualizado = await (0, db_1.withTransaction)(async (execute) => {
                await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + db_1.lockRow);
                await execute('SELECT id FROM colaboradores WHERE id = ?' + db_1.lockRow, [id]);
                const safe = { ...req.body };
                delete safe.foto_url;
                const result = await ColaboradorService_1.ColaboradorService.editar(id, safe);
                await (0, OperationalService_1.audit)(req.user.id, 'ATUALIZAR', 'colaborador', id, safe, execute);
                return result;
            });
            return res.json(atualizado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async associarNfc(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { nfc_id } = req.body;
            (0, OperationalService_1.text)(nfc_id, 'Cartão NFC');
            const atualizado = await (0, db_1.withTransaction)(async (execute) => {
                await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + db_1.lockRow);
                const result = await ColaboradorService_1.ColaboradorService.associarNfc(id, nfc_id);
                if (!result)
                    throw new Error('Colaborador não encontrado');
                await (0, OperationalService_1.audit)(req.user.id, 'VINCULAR_NFC', 'colaborador', id, { nfc_id }, execute);
                return result;
            });
            return res.json(atualizado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.ColaboradorController = ColaboradorController;
