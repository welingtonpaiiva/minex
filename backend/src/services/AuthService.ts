import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, query } from '../config/db';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/auth';
import { text, roles } from './OperationalService';

export class AuthService {
  static async login(matricula: string, senha: string) {
    text(matricula, 'Matrícula');
    text(senha, 'Senha', 200);
    if (!matricula || !senha) {
      throw new Error('Matrícula e senha são obrigatórias');
    }

    const user = await queryOne('SELECT * FROM usuarios WHERE matricula = ?', [matricula.trim()]);
    if (!user) {
      throw new Error('Matrícula ou senha inválida');
    }

    if (user.status !== 'ATIVO') {
      throw new Error('Usuário inativo no sistema');
    }

    const isValid = await bcrypt.compare(senha, user.senha_hash);
    if (!isValid) {
      throw new Error('Matrícula ou senha inválida');
    }

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        matricula: user.matricula,
        nivel_acesso: user.nivel_acesso
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        nome: user.nome,
        matricula: user.matricula,
        nivel_acesso: user.nivel_acesso
      }
    };
  }

  static async listarUsuarios() {
    return await query('SELECT id, nome, matricula, nivel_acesso, status, created_at FROM usuarios ORDER BY nome ASC');
  }

  static async criarUsuario(dados: { nome: string; matricula: string; senha: string; nivel_acesso: string }) {
    text(dados.nome, 'Nome'); text(dados.matricula, 'Matrícula'); text(dados.senha, 'Senha', 200);
    if (dados.senha.length < 12) throw new Error('Use uma senha de pelo menos 12 caracteres');
    if (!roles.includes(dados.nivel_acesso)) throw new Error('Perfil inválido');
    const exist = await queryOne('SELECT id FROM usuarios WHERE matricula = ?', [dados.matricula.trim()]);
    if (exist) {
      throw new Error('Já existe um usuário com esta matrícula');
    }

    const hash = await bcrypt.hash(dados.senha, 10);
    await query(
      'INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)',
      [dados.nome.trim(), dados.matricula.trim(), hash, dados.nivel_acesso || 'OPERADOR', 'ATIVO']
    );

    return { success: true, message: 'Usuário cadastrado com sucesso' };
  }
}
