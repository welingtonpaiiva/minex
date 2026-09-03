import { Response } from 'express';
import { AcessoMinaService } from '../services/AcessoMinaService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class AcessoMinaController {
  static async buscarAtivos(req: AuthenticatedRequest, res: Response) {
    try {
      const ativos = await AcessoMinaService.buscarAtivos();
      return res.json(ativos);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao buscar acessos ativos' });
    }
  }

  static async buscarHistorico(req: AuthenticatedRequest, res: Response) {
    try {
      const historico = await AcessoMinaService.buscarHistorico();
      return res.json(historico);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao buscar histórico de acessos' });
    }
  }
}
