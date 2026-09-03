"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AcessoMinaController = void 0;
const AcessoMinaService_1 = require("../services/AcessoMinaService");
class AcessoMinaController {
    static async buscarAtivos(req, res) {
        try {
            const ativos = await AcessoMinaService_1.AcessoMinaService.buscarAtivos();
            return res.json(ativos);
        }
        catch (err) {
            return res.status(500).json({ error: err.message || 'Erro ao buscar acessos ativos' });
        }
    }
    static async buscarHistorico(req, res) {
        try {
            const historico = await AcessoMinaService_1.AcessoMinaService.buscarHistorico();
            return res.json(historico);
        }
        catch (err) {
            return res.status(500).json({ error: err.message || 'Erro ao buscar histórico de acessos' });
        }
    }
}
exports.AcessoMinaController = AcessoMinaController;
