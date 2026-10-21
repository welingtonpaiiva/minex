"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoFolder = void 0;
const express_1 = require("express");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const sharp_1 = __importDefault(require("sharp"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const db_1 = require("../config/db");
const OperationalService_1 = require("../services/OperationalService");
exports.photoFolder = path_1.default.resolve(__dirname, '../../uploads');
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/:file', (req, res) => {
    if (!/^[a-f0-9-]{36}\.jpg$/.test(req.params.file))
        return res.sendStatus(404);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path_1.default.join(exports.photoFolder, req.params.file), err => { if (err && !res.headersSent)
        res.sendStatus(404); });
});
router.post('/:colaboradorId', (0, authMiddleware_1.requireRole)(OperationalService_1.registrationRoles), async (req, res, next) => {
    let file;
    try {
        const ref = (0, OperationalService_1.id)(req.params.colaboradorId);
        if (!await (0, db_1.queryOne)('SELECT id FROM colaboradores WHERE id = ?', [ref]))
            throw new Error('Colaborador não encontrado');
        if (typeof req.body.imagem !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(req.body.imagem))
            throw new Error('Selecione uma fotografia JPEG');
        let buffer = Buffer.from(req.body.imagem.split(',')[1], 'base64');
        if (buffer.length < 20 || buffer.length > 512 * 1024 || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9)
            throw new Error('Fotografia inválida ou acima de 512 KB');
        const processed = await (0, sharp_1.default)(buffer, { limitInputPixels: 25000000 }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
        buffer = processed.data;
        const hash = crypto_1.default.createHash('sha256').update(buffer).digest('hex');
        const previous = await (0, db_1.queryOne)('SELECT * FROM fotos WHERE sha256 = ?', [hash]);
        if (previous) {
            if (previous.colaborador_id !== ref)
                throw new Error('Esta fotografia já pertence a outro colaborador. Confira a identificação.');
            const existing = '/api/fotos/' + previous.arquivo;
            await (0, db_1.withTransaction)(async (execute) => {
                await execute('UPDATE colaboradores SET foto_url = ? WHERE id = ?', [existing, ref]);
                await (0, OperationalService_1.audit)(req.user.id, 'FOTOGRAFIA', 'colaborador', ref, { foto_url: existing }, execute);
            });
            return res.json({ foto_url: existing });
        }
        await promises_1.default.mkdir(exports.photoFolder, { recursive: true });
        const filename = crypto_1.default.randomUUID() + '.jpg';
        file = path_1.default.join(exports.photoFolder, filename);
        await promises_1.default.writeFile(file, buffer, { flag: 'wx' });
        const url = '/api/fotos/' + filename;
        await (0, db_1.withTransaction)(async (execute) => {
            await execute('INSERT INTO fotos (colaborador_id, arquivo, sha256, tamanho, largura, altura, responsavel_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [ref, filename, hash, buffer.length, processed.info.width, processed.info.height, req.user.id, new Date().toISOString()]);
            await execute('UPDATE colaboradores SET foto_url = ?, updated_at = ? WHERE id = ?', [url, new Date().toISOString(), ref]);
            await (0, OperationalService_1.audit)(req.user.id, 'FOTOGRAFIA', 'colaborador', ref, { foto_url: url }, execute);
        });
        res.json({ foto_url: url });
    }
    catch (error) {
        if (file)
            await promises_1.default.unlink(file).catch(() => { });
        next(error);
    }
});
exports.default = router;
