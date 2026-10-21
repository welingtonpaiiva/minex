"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../config/auth");
const db_1 = require("../config/db");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, auth_1.JWT_SECRET, { algorithms: ['HS256'] });
        const user = await (0, db_1.queryOne)('SELECT id, nome, matricula, nivel_acesso, status FROM usuarios WHERE id = ?', [decoded.id]);
        if (!user || user.status !== 'ATIVO')
            return res.status(401).json({ error: 'Conta inativa ou sessão encerrada' });
        req.user = user;
        next();
    }
    catch (err) {
        if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name))
            return res.status(503).json({ error: 'Não foi possível validar a sessão. Tente novamente.' });
        return res.status(401).json({ error: 'Sessão expirada ou token inválido' });
    }
}
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }
        if (!roles.includes(req.user.nivel_acesso)) {
            return res.status(403).json({ error: 'Acesso negado: Nível de permissão insuficiente' });
        }
        next();
    };
}
