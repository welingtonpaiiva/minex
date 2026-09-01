"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricoController = void 0;
const HistoricoService_1 = require("../services/HistoricoService");
class HistoricoController {
    static async listar(req, res) {
        try {
            const { busca, tipo, colaborador_id, material_id, data_inicio, data_fim, limit } = req.query;
            const logs = await HistoricoService_1.HistoricoService.listar({
                busca: busca,
                tipo: tipo,
                colaborador_id: colaborador_id ? parseInt(colaborador_id) : undefined,
                material_id: material_id ? parseInt(material_id) : undefined,
                data_inicio: data_inicio,
                data_fim: data_fim,
                limit: limit ? parseInt(limit) : undefined
            });
            return res.json(logs);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async historicoColaborador(req, res) {
        try {
            const id = parseInt(req.params.colaboradorId);
            const logs = await HistoricoService_1.HistoricoService.historicoColaborador(id);
            return res.json(logs);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async historicoMaterial(req, res) {
        try {
            const id = parseInt(req.params.materialId);
            const logs = await HistoricoService_1.HistoricoService.historicoMaterial(id);
            return res.json(logs);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.HistoricoController = HistoricoController;
