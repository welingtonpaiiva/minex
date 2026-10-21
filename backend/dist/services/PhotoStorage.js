"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoFolder = void 0;
exports.readPhoto = readPhoto;
exports.importPhotoFiles = importPhotoFiles;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../config/db");
exports.photoFolder = path_1.default.resolve(__dirname, '../../uploads');
async function readPhoto(filename, execute = db_1.query) {
    if (!/^[a-f0-9-]{36}\.jpg$/.test(filename))
        throw new Error('Referência de foto inválida');
    const record = (await execute('SELECT f.sha256, c.imagem_base64 FROM fotos f LEFT JOIN foto_conteudos c ON c.foto_id=f.id WHERE f.arquivo=?', [filename]))[0];
    if (!record)
        throw Object.assign(new Error('Foto não encontrada'), { code: 'ENOENT' });
    // Existing installations can still read their original files until imported.
    const content = record.imagem_base64
        ? Buffer.from(record.imagem_base64, 'base64')
        : await promises_1.default.readFile(path_1.default.join(exports.photoFolder, filename));
    if (crypto_1.default.createHash('sha256').update(content).digest('hex') !== record.sha256)
        throw new Error('Foto com integridade inválida');
    return content;
}
async function importPhotoFiles() {
    const records = await (0, db_1.query)('SELECT f.id, f.arquivo FROM fotos f LEFT JOIN foto_conteudos c ON c.foto_id=f.id WHERE c.id IS NULL');
    let imported = 0;
    for (const record of records) {
        const content = await readPhoto(record.arquivo);
        await (0, db_1.withTransaction)(async (execute) => {
            if ((await execute('SELECT id FROM foto_conteudos WHERE foto_id=?', [record.id])).length)
                return;
            await execute('INSERT INTO foto_conteudos (foto_id, imagem_base64) VALUES (?, ?)', [record.id, content.toString('base64')]);
            imported++;
        });
    }
    return imported;
}
