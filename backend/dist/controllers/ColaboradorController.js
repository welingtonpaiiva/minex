"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColaboradorController = void 0;
const ColaboradorService_1 = require("../services/ColaboradorService");
class ColaboradorController {
    static async listar(req, res) {
        try {
            const { busca, status } = req.query;
            const colaboradores = await ColaboradorService_1.ColaboradorService.listar(busca, status);
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
            const novo = await ColaboradorService_1.ColaboradorService.criar(req.body);
            return res.status(201).json(novo);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async editar(req, res) {
        try {
            const id = parseInt(req.params.id);
            const atualizado = await ColaboradorService_1.ColaboradorService.editar(id, req.body);
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
            const atualizado = await ColaboradorService_1.ColaboradorService.associarNfc(id, nfc_id);
            return res.json(atualizado);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.ColaboradorController = ColaboradorController;
