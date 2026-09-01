import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { matricula, senha } = req.body;
      const result = await AuthService.login(matricula, senha);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao realizar login' });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    return res.json({ user: req.user });
  }

  static async listarUsuarios(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await AuthService.listarUsuarios();
      return res.json(users);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async criarUsuario(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await AuthService.criarUsuario(req.body);
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
