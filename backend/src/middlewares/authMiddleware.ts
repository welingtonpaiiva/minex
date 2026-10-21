import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth';
import { queryOne } from '../config/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    nome: string;
    matricula: string;
    nivel_acesso: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    const user = await queryOne('SELECT id, nome, matricula, nivel_acesso, status FROM usuarios WHERE id = ?', [decoded.id]);
    if (!user || user.status !== 'ATIVO') return res.status(401).json({ error: 'Conta inativa ou sessão encerrada' });
    req.user = user;
    next();
  } catch (err: any) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return res.status(503).json({ error: 'Não foi possível validar a sessão. Tente novamente.' });
    return res.status(401).json({ error: 'Sessão expirada ou token inválido' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!roles.includes(req.user.nivel_acesso)) {
      return res.status(403).json({ error: 'Acesso negado: Nível de permissão insuficiente' });
    }

    next();
  };
}
