"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
class AuthController {
    static async login(req, res) {
        try {
            const { matricula, senha } = req.body;
            const result = await AuthService_1.AuthService.login(matricula, senha);
            return res.json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message || 'Erro ao realizar login' });
        }
    }
    static async me(req, res) {
        return res.json({ user: req.user });
    }
    static async listarUsuarios(req, res) {
        try {
            const users = await AuthService_1.AuthService.listarUsuarios();
            return res.json(users);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async criarUsuario(req, res) {
        try {
            const result = await AuthService_1.AuthService.criarUsuario(req.body);
            return res.status(201).json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.AuthController = AuthController;
