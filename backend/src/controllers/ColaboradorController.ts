import { Request, Response } from 'express';
import { ColaboradorService } from '../services/ColaboradorService';

export class ColaboradorController {
  static async listar(req: Request, res: Response) {
    try {
      const { busca, status } = req.query;
      const colaboradores = await ColaboradorService.listar(busca as string, status as string);
      return res.json(colaboradores);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarPorNfc(req: Request, res: Response) {
    try {
      const { nfcId } = req.params;
      const colab = await ColaboradorService.buscarPorNfc(nfcId);
      if (!colab) {
        return res.status(404).json({ error: 'COLABORADOR NÃO ENCONTRADO PARA ESTE CARTÃO NFC' });
      }
      return res.json(colab);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarPorMatricula(req: Request, res: Response) {
    try {
      const { matricula } = req.params;
      const colab = await ColaboradorService.buscarPorMatricula(matricula);
      if (!colab) {
        return res.status(404).json({ error: 'COLABORADOR NÃO ENCONTRADO PARA ESTA MATRÍCULA' });
      }
      return res.json(colab);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarPorId(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const colab = await ColaboradorService.buscarPorId(id);
      if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });
      return res.json(colab);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async criar(req: Request, res: Response) {
    try {
      const novo = await ColaboradorService.criar(req.body);
      return res.status(201).json(novo);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async editar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const atualizado = await ColaboradorService.editar(id, req.body);
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async associarNfc(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nfc_id } = req.body;
      const atualizado = await ColaboradorService.associarNfc(id, nfc_id);
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
