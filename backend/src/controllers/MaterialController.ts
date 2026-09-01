import { Request, Response } from 'express';
import { MaterialService } from '../services/MaterialService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class MaterialController {
  static async listar(req: Request, res: Response) {
    try {
      const { busca, categoria_id, status } = req.query;
      const materiais = await MaterialService.listar({
        busca: busca as string,
        categoria_id: categoria_id ? parseInt(categoria_id as string) : undefined,
        status: status as string
      });
      return res.json(materiais);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarPorCodigo(req: Request, res: Response) {
    try {
      const { codigo } = req.params;
      const mat = await MaterialService.buscarPorCodigo(codigo);
      if (!mat) {
        return res.status(404).json({ error: 'MATERIAL NÃO CADASTRADO' });
      }
      return res.json(mat);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async buscarPorId(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const mat = await MaterialService.buscarPorId(id);
      if (!mat) return res.status(404).json({ error: 'Material não encontrado' });
      return res.json(mat);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async criar(req: Request, res: Response) {
    try {
      const novo = await MaterialService.criar(req.body);
      return res.status(201).json(novo);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async editar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const atualizado = await MaterialService.editar(id, req.body);
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async alterarStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status, observacao } = req.body;
      const operadorId = req.user?.id || 1;
      const atualizado = await MaterialService.alterarStatus(id, status, observacao, operadorId);
      return res.json(atualizado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async listarCategorias(req: Request, res: Response) {
    try {
      const categorias = await MaterialService.listarCategorias();
      return res.json(categorias);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async excluir(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const resultado = await MaterialService.excluir(id);
      return res.json(resultado);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
