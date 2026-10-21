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
const OperationalService_1 = require("./OperationalService");
class AuthService {
    static async login(matricula, senha) {
        (0, OperationalService_1.text)(matricula, 'Matrícula');
        (0, OperationalService_1.text)(senha, 'Senha', 200);
        if (!matricula || !senha) {
            throw new Error('Matrícula e senha são obrigatórias');
        }
        const user = await (0, db_1.queryOne)('SELECT * FROM usuarios WHERE matricula = ?', [matricula.trim()]);
        if (!user) {
            throw new Error('Matrícula ou senha inválida');
        }
        if (user.status !== 'ATIVO') {
            throw new Error('Usuário inativo no sistema');
        }
        const isValid = await bcryptjs_1.default.compare(senha, user.senha_hash);
        if (!isValid) {
            throw new Error('Matrícula ou senha inválida');
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
        (0, OperationalService_1.text)(dados.nome, 'Nome');
        (0, OperationalService_1.text)(dados.matricula, 'Matrícula');
        (0, OperationalService_1.text)(dados.senha, 'Senha', 200);
        if (dados.senha.length < 12)
            throw new Error('Use uma senha de pelo menos 12 caracteres');
        if (!OperationalService_1.roles.includes(dados.nivel_acesso))
            throw new Error('Perfil inválido');
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
