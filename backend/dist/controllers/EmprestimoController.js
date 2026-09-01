"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmprestimoController = void 0;
const EmprestimoService_1 = require("../services/EmprestimoService");
class EmprestimoController {
    static async buscarEmprestimosDoColaborador(req, res) {
        try {
            const colaboradorId = parseInt(req.params.colaboradorId);
            const emprestimos = await EmprestimoService_1.EmprestimoService.buscarEmprestimosDoColaborador(colaboradorId);
            return res.json(emprestimos);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async buscarEmprestimosAtivos(req, res) {
        try {
            const { busca } = req.query;
            const emprestimos = await EmprestimoService_1.EmprestimoService.buscarEmprestimosAtivos(busca);
            return res.json(emprestimos);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async realizarSaida(req, res) {
        try {
            const { colaboradorId, materiaisCodigos } = req.body;
            const operadorId = req.user?.id || 1;
            const operadorNome = req.user?.nome || 'OPERADOR';
            const result = await EmprestimoService_1.EmprestimoService.realizarSaida({
                colaboradorId: parseInt(colaboradorId),
                materiaisCodigos,
                operadorId,
                operadorNome
            });
            return res.json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message || 'Erro ao registrar saída' });
        }
    }
    static async realizarEntrada(req, res) {
        try {
            const { colaboradorId, materiaisCodigos } = req.body;
            const operadorId = req.user?.id || 1;
            const operadorNome = req.user?.nome || 'OPERADOR';
            const result = await EmprestimoService_1.EmprestimoService.realizarEntrada({
                colaboradorId: parseInt(colaboradorId),
                materiaisCodigos,
                operadorId,
                operadorNome
            });
            return res.json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message || 'Erro ao registrar entrada' });
        }
    }
    static async buscarAlertasTurno(req, res) {
        try {
            const alertas = await EmprestimoService_1.EmprestimoService.buscarAlertasTurno();
            return res.json(alertas);
        }
        catch (err) {
            return res.status(400).json({ error: err.message || 'Erro ao buscar alertas de turno' });
        }
    }
}
exports.EmprestimoController = EmprestimoController;
