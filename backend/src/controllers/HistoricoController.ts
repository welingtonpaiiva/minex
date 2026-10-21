import { Request, Response } from 'express';
import { HistoricoService } from '../services/HistoricoService';

export class HistoricoController {
  static async listar(req: Request, res: Response) {
    try {
      const { busca, tipo, colaborador_id, material_id, data_inicio, data_fim, limit } = req.query;

      const logs = await HistoricoService.listar({
        busca: busca as string,
        tipo: tipo as string,
        colaborador_id: colaborador_id ? parseInt(colaborador_id as string) : undefined,
        material_id: material_id ? parseInt(material_id as string) : undefined,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: Math.max(0, (Number(req.query.page) || 1) - 1) * Math.min(500, Math.max(1, Number(limit) || 50))
      });

      if (req.query.paginado === 'true') return res.json({ items: logs, total: (logs as any).total, page: Number(req.query.page) || 1 });
      return res.json(logs);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async historicoColaborador(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.colaboradorId);
      const logs = await HistoricoService.historicoColaborador(id);
      return res.json(logs);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async historicoMaterial(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.materialId);
      const logs = await HistoricoService.historicoMaterial(id);
      return res.json(logs);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
