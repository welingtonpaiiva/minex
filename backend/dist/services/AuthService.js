"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const auth_1 = require("../config/auth");
class AuthService {
    static async login(matricula, senha) {
        if (!matricula || !senha) {
            throw new Error('Matrícula e senha são obrigatórias');
        }
        const user = await (0, db_1.queryOne)('SELECT * FROM usuarios WHERE matricula = ?', [matricula.trim()]);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        if (user.status !== 'ATIVO') {
            throw new Error('Usuário inativo no sistema');
        }
        const isValid = await bcryptjs_1.default.compare(senha, user.senha_hash);
        if (!isValid) {
            throw new Error('Senha incorreta');
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            nome: user.nome,
            matricula: user.matricula,
            nivel_acesso: user.nivel_acesso
        }, auth_1.JWT_SECRET, { expiresIn: auth_1.JWT_EXPIRES_IN });
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
        return await (0, db_1.query)('SELECT id, nome, matricula, nivel_acesso, status, created_at FROM usuarios ORDER BY nome ASC');
    }
    static async criarUsuario(dados) {
        const exist = await (0, db_1.queryOne)('SELECT id FROM usuarios WHERE matricula = ?', [dados.matricula.trim()]);
        if (exist) {
            throw new Error('Já existe um usuário com esta matrícula');
        }
        const hash = await bcryptjs_1.default.hash(dados.senha, 10);
        await (0, db_1.query)('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)', [dados.nome.trim(), dados.matricula.trim(), hash, dados.nivel_acesso || 'OPERADOR', 'ATIVO']);
        return { success: true, message: 'Usuário cadastrado com sucesso' };
    }
}
exports.AuthService = AuthService;
