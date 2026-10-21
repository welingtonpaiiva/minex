import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Executor, query, withTransaction } from '../config/db';

export const photoFolder = path.resolve(__dirname, '../../uploads');

export async function readPhoto(filename: string, execute: Executor = query): Promise<Buffer> {
  if (!/^[a-f0-9-]{36}\.jpg$/.test(filename)) throw new Error('Referência de foto inválida');
  const record = (await execute('SELECT f.sha256, c.imagem_base64 FROM fotos f LEFT JOIN foto_conteudos c ON c.foto_id=f.id WHERE f.arquivo=?', [filename]))[0];
  if (!record) throw Object.assign(new Error('Foto não encontrada'), { code: 'ENOENT' });
  // Existing installations can still read their original files until imported.
  const content = record.imagem_base64
    ? Buffer.from(record.imagem_base64, 'base64')
    : await fs.readFile(path.join(photoFolder, filename));
  if (crypto.createHash('sha256').update(content).digest('hex') !== record.sha256) throw new Error('Foto com integridade inválida');
  return content;
}

export async function importPhotoFiles() {
  const records = await query('SELECT f.id, f.arquivo FROM fotos f LEFT JOIN foto_conteudos c ON c.foto_id=f.id WHERE c.id IS NULL');
  let imported = 0;
  for (const record of records) {
    const content = await readPhoto(record.arquivo);
    await withTransaction(async execute => {
      if ((await execute('SELECT id FROM foto_conteudos WHERE foto_id=?', [record.id])).length) return;
      await execute('INSERT INTO foto_conteudos (foto_id, imagem_base64) VALUES (?, ?)', [record.id, content.toString('base64')]);
      imported++;
    });
  }
  return imported;
}
