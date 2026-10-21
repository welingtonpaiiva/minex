import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import sharp from 'sharp';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { queryOne, withTransaction } from '../config/db';
import { id, audit, registrationRoles } from '../services/OperationalService';
import { readPhoto } from '../services/PhotoStorage';
export { photoFolder } from '../services/PhotoStorage';
const router = Router();
router.use(authMiddleware);
router.get('/:file', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!/^[a-f0-9-]{36}\.jpg$/.test(req.params.file)) return res.sendStatus(404);
  res.setHeader('Cache-Control', 'private, no-store');
  try { res.type('image/jpeg').send(await readPhoto(req.params.file)); }
  catch (error: any) { if (error.code === 'ENOENT') res.sendStatus(404); else next(error); }
});
router.post('/:colaboradorId', requireRole(registrationRoles), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ref = id(req.params.colaboradorId);
    if (!await queryOne('SELECT id FROM colaboradores WHERE id = ?', [ref])) throw new Error('Colaborador não encontrado');
    if (typeof req.body.imagem !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(req.body.imagem)) throw new Error('Selecione uma fotografia JPEG');
    let buffer = Buffer.from(req.body.imagem.split(',')[1], 'base64');
    if (buffer.length < 20 || buffer.length > 512 * 1024 || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) throw new Error('Fotografia inválida ou acima de 512 KB');
    const processed = await sharp(buffer, { limitInputPixels: 25000000 }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
    buffer = processed.data;
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const previous = await queryOne('SELECT * FROM fotos WHERE sha256 = ?', [hash]);
    if (previous) {
      if (previous.colaborador_id !== ref) throw new Error('Esta fotografia já pertence a outro colaborador. Confira a identificação.');
      const existing = '/api/fotos/' + previous.arquivo;
      await withTransaction(async execute => {
        if (!(await execute('SELECT id FROM foto_conteudos WHERE foto_id=?', [previous.id])).length) {
          await execute('INSERT INTO foto_conteudos (foto_id, imagem_base64) VALUES (?, ?)', [previous.id, buffer.toString('base64')]);
        }
        await execute('UPDATE colaboradores SET foto_url = ? WHERE id = ?', [existing, ref]);
        await audit(req.user!.id, 'FOTOGRAFIA', 'colaborador', ref, { foto_url: existing }, execute);
      });
      return res.json({ foto_url: existing });
    }
    const filename = crypto.randomUUID() + '.jpg';
    const url = '/api/fotos/' + filename;
    await withTransaction(async execute => {
      const inserted = await execute('INSERT INTO fotos (colaborador_id, arquivo, sha256, tamanho, largura, altura, responsavel_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [ref, filename, hash, buffer.length, processed.info.width, processed.info.height, req.user!.id, new Date().toISOString()]);
      await execute('INSERT INTO foto_conteudos (foto_id, imagem_base64) VALUES (?, ?)', [inserted[0].id, buffer.toString('base64')]);
      await execute('UPDATE colaboradores SET foto_url = ?, updated_at = ? WHERE id = ?', [url, new Date().toISOString(), ref]);
      await audit(req.user!.id, 'FOTOGRAFIA', 'colaborador', ref, { foto_url: url }, execute);
    });
    res.json({ foto_url: url });
  } catch (error) { next(error); }
});
export default router;
