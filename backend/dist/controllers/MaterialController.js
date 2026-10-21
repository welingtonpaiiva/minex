"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialController = void 0;
const MaterialService_1 = require("../services/MaterialService");
const db_1 = require("../config/db");
const OperationalService_1 = require("../services/OperationalService");
class MaterialController {
    static async listar(req, res) {
        try {
            const { busca, categoria_id, status } = req.query;
            const materiais = await MaterialService_1.MaterialService.listar({
                busca: busca,
                categoria_id: categoria_id ? parseInt(categoria_id) : undefined,
                status: status
            });
            return res.json(materiais);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarPorCodigo(req, res) {
        try {
            const { codigo } = req.params;
            const mat = await MaterialService_1.MaterialService.buscarPorCodigo(codigo);
            if (!mat) {
                return res.status(404).json({ error: 'MATERIAL NÃO CADASTRADO' });
            }
            return res.json(mat);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarPorId(req, res) {
        try {
            const id = parseInt(req.params.id);
            const mat = await MaterialService_1.MaterialService.buscarPorId(id);
            if (!mat)
                return res.status(404).json({ error: 'Material não encontrado' });
            return res.json(mat);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async criar(req, res) {
        try {
            const novo = await (0, db_1.withTransaction)(async (execute) => {
                const result = await MaterialService_1.MaterialService.criar(req.body);
                await (0, OperationalService_1.audit)(req.user.id, 'CRIAR', 'material', result.id, { codigo: result.codigo_interno, nome: result.nome }, execute);
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
            const atualizado = await (0, db_1.withTransaction)(async (execute) => {
                const result = await MaterialService_1.MaterialService.editar(id, req.body);
                await (0, OperationalService_1.audit)(req.user.id, 'ATUALIZAR', 'material', id, req.body, execute);
                return result;
            });
            return res.json(atualizado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async alterarStatus(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { status, observacao } = req.body;
            const operadorId = req.user?.id || 1;
            const atualizado = await MaterialService_1.MaterialService.alterarStatus(id, status, observacao, operadorId);
            return res.json(atualizado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async listarCategorias(req, res) {
        try {
            const categorias = await MaterialService_1.MaterialService.listarCategorias();
            return res.json(categorias);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async excluir(req, res) {
        try {
            const id = parseInt(req.params.id);
            const resultado = await MaterialService_1.MaterialService.alterarStatus(id, 'INATIVO', req.body.observacao || 'Inativação administrativa; histórico preservado', req.user.id);
            return res.json(resultado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.MaterialController = MaterialController;
