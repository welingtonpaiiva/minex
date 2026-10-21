import { Request, Response } from 'express';
import { ColaboradorService } from '../services/ColaboradorService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { audit, text } from '../services/OperationalService';
import { withTransaction, lockRow } from '../config/db';

export class ColaboradorController {
  static async listar(req: Request, res: Response) {
    try {
      const { busca, status } = req.query;
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
      const colaboradores = await ColaboradorService.listar(busca as string, status as string, limit, Math.max(0, (Number(req.query.page) || 1)-1)*limit);
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

  static async criar(req: AuthenticatedRequest, res: Response) {
    try {
      text(req.body.nome, 'Nome'); text(req.body.matricula, 'Matrícula');
      for (const field of ['setor', 'cargo', 'nfc_id']) if (req.body[field] != null) text(req.body[field], field, 255, false);
      const novo = await withTransaction(async execute => {
        await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + lockRow);
        const result = await ColaboradorService.criar({ ...req.body, foto_url: '' });
        await audit(req.user!.id, 'CRIAR', 'colaborador', result.id, { nome: result.nome, matricula: result.matricula }, execute); return result;
      });
      return res.status(201).json(novo);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async editar(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (req.body.nome !== undefined) text(req.body.nome, 'Nome');
      for (const field of ['setor', 'cargo', 'nfc_id']) if (req.body[field] != null) text(req.body[field], field, 255, false);
      if (req.body.status !== undefined && !['ATIVO', 'INATIVO'].includes(req.body.status)) throw new Error('Situação inválida');
      const atualizado = await withTransaction(async execute => {
        await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + lockRow);
        await execute('SELECT id FROM colaboradores WHERE id = ?' + lockRow, [id]);
        const safe = { ...req.body }; delete safe.foto_url;
        const result = await ColaboradorService.editar(id, safe);
        await audit(req.user!.id, 'ATUALIZAR', 'colaborador', id, safe, execute); return result;
      });
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async associarNfc(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nfc_id } = req.body;
      text(nfc_id, 'Cartão NFC');
      const atualizado = await withTransaction(async execute => {
        await execute("SELECT id FROM usuarios WHERE nivel_acesso = 'ADMINISTRADOR' ORDER BY id LIMIT 1" + lockRow);
        const result = await ColaboradorService.associarNfc(id, nfc_id);
        if (!result) throw new Error('Colaborador não encontrado');
        await audit(req.user!.id, 'VINCULAR_NFC', 'colaborador', id, { nfc_id }, execute); return result;
      });
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
