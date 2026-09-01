"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelatorioController = void 0;
const RelatorioService_1 = require("../services/RelatorioService");
class RelatorioController {
    static async obterResumo(req, res) {
        try {
            const resumo = await RelatorioService_1.RelatorioService.obterResumo();
            return res.json(resumo);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async exportarExcel(req, res) {
        try {
            const buffer = await RelatorioService_1.RelatorioService.gerarExcelMovimentacoes(req.query);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=relatorio_movimentacoes_casa_da_lanterna.xlsx');
            return res.send(buffer);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async exportarPdfEmUso(req, res) {
        try {
            const buffer = await RelatorioService_1.RelatorioService.gerarPdfMateriaisEmUso();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=materiais_em_uso_casa_da_lanterna.pdf');
            return res.send(buffer);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.RelatorioController = RelatorioController;
