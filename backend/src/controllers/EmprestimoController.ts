import { Response } from 'express';
import { EmprestimoService } from '../services/EmprestimoService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class EmprestimoController {
  static async buscarEmprestimosDoColaborador(req: AuthenticatedRequest, res: Response) {
    try {
      const colaboradorId = parseInt(req.params.colaboradorId);
      const emprestimos = await EmprestimoService.buscarEmprestimosDoColaborador(colaboradorId);
      return res.json(emprestimos);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarEmprestimosAtivos(req: AuthenticatedRequest, res: Response) {
    try {
      const { busca } = req.query;
      const emprestimos = await EmprestimoService.buscarEmprestimosAtivos(busca as string);
      return res.json(emprestimos);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async realizarSaida(req: AuthenticatedRequest, res: Response) {
    try {
      const { colaboradorId, materiaisCodigos } = req.body;
      const operadorId = req.user?.id || 1;
      const operadorNome = req.user?.nome || 'OPERADOR';

      const result = await EmprestimoService.realizarSaida({
        colaboradorId: parseInt(colaboradorId),
        materiaisCodigos,
        operadorId,
        operadorNome
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao registrar saída' });
    }
  }

  static async realizarEntrada(req: AuthenticatedRequest, res: Response) {
    try {
      const { colaboradorId, materiaisCodigos } = req.body;
      const operadorId = req.user?.id || 1;
      const operadorNome = req.user?.nome || 'OPERADOR';

      const result = await EmprestimoService.realizarEntrada({
        colaboradorId: parseInt(colaboradorId),
        materiaisCodigos,
        operadorId,
        operadorNome
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao registrar entrada' });
    }
  }
}
