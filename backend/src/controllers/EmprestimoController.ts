import { Response } from 'express';
import { EmprestimoService } from '../services/EmprestimoService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { withTransaction, lockRow } from '../config/db';
import { validateReturnNfc, validateReturnBarcodes } from '../services/ReturnReadings';

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
        operadorNome,
        requestId: req.header('Idempotency-Key') || req.body.requestId
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

      const result = await withTransaction(async execute => {
        await execute('SELECT id FROM usuarios WHERE id = ?' + lockRow, [operadorId]);
        await validateReturnNfc(Number(colaboradorId), req.body.nfcId);
        await validateReturnBarcodes(materiaisCodigos);
        return EmprestimoService.realizarEntrada({
          colaboradorId: parseInt(colaboradorId),
          materiaisCodigos,
          operadorId,
          operadorNome,
          requestId: req.header('Idempotency-Key') || req.body.requestId,
          condicao: req.body.condicao
        });
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao registrar entrada' });
    }
  }

  static async buscarAlertasTurno(req: AuthenticatedRequest, res: Response) {
    try {
      const alertas = await EmprestimoService.buscarAlertasTurno();
      return res.json(alertas);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao buscar alertas de turno' });
    }
  }
}

