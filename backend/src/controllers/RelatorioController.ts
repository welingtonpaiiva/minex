import { Request, Response } from 'express';
import { RelatorioService } from '../services/RelatorioService';

export class RelatorioController {
  static async obterResumo(req: Request, res: Response) {
    try {
      const resumo = await RelatorioService.obterResumo();
      return res.json(resumo);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async exportarExcel(req: Request, res: Response) {
    try {
      const buffer = await RelatorioService.gerarExcelMovimentacoes(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_movimentacoes_casa_da_lanterna.xlsx');
      return res.send(buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async exportarPdfEmUso(req: Request, res: Response) {
    try {
      const buffer = await RelatorioService.gerarPdfMateriaisEmUso();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=materiais_em_uso_casa_da_lanterna.pdf');
      return res.send(buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
