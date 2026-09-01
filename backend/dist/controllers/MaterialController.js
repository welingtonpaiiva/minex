"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialController = void 0;
const MaterialService_1 = require("../services/MaterialService");
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
            const novo = await MaterialService_1.MaterialService.criar(req.body);
            return res.status(201).json(novo);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async editar(req, res) {
        try {
            const id = parseInt(req.params.id);
            const atualizado = await MaterialService_1.MaterialService.editar(id, req.body);
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
}
exports.MaterialController = MaterialController;
