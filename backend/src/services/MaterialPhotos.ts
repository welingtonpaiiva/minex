import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { queryOne, withTransaction, lockRow } from '../config/db';
import { audit, id } from './OperationalService';

export const materialPhotoCatalog = [
  { nome: 'Bateria de rádio', codigo: 'BR', arquivo: 'bateria-radio.png' },
  { nome: 'Lanterna de mineiro', codigo: 'LM', arquivo: 'lanterna-mineiro.png' },
  { nome: 'Medidor de gás', codigo: 'MG', arquivo: 'medidor-gas.png' },
  { nome: 'Mega Light', codigo: 'ML', arquivo: 'mega-light.png' },
  { nome: 'Sinalizador', codigo: 'TL', arquivo: 'sinalizador.png' }
].map(item => ({ ...item, foto_url: '/images/equipamentos/' + item.arquivo }));

export function availableMaterialPhotos() {
  return materialPhotoCatalog.filter(item => ['public', 'dist'].some(folder => fs.existsSync(path.resolve(__dirname, '../../../frontend/' + folder + item.foto_url))));
}

export function defaultMaterialPhoto(code: string) {
  return availableMaterialPhotos().find(item => new RegExp('^' + item.codigo + '-\\d+$').test(code))?.foto_url || '';
}

export async function validateMaterialPhotoReference(value: unknown): Promise<string> {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error('Referência de foto do material inválida.');
  if (availableMaterialPhotos().some(item => item.foto_url === value)) return value;
  const filename = value.match(/^\/api\/materiais\/fotos\/([a-f0-9-]{36}\.webp)$/)?.[1];
  if (!filename || !await queryOne('SELECT id FROM material_fotos WHERE arquivo=?', [filename])) throw new Error('Selecione uma foto do catálogo ou anexe uma foto do equipamento.');
  return value;
}

export async function readMaterialPhoto(filename: string) {
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return null;
  const record = await queryOne('SELECT imagem_base64,sha256 FROM material_fotos WHERE arquivo=?', [filename]);
  if (!record) return null;
  const buffer = Buffer.from(record.imagem_base64, 'base64');
  if (crypto.createHash('sha256').update(buffer).digest('hex') !== record.sha256) throw new Error('Foto do material com integridade inválida.');
  return buffer;
}

export async function attachMaterialPhoto(materialId: number, image: unknown, userId: number) {
  id(materialId); id(userId);
  if (typeof image !== 'string' || image.length > 3 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Selecione uma foto JPEG, PNG ou WebP de até 2 MB.');
  const source = Buffer.from(image.split(',')[1], 'base64');
  if (source.length < 20 || source.length > 2 * 1024 * 1024) throw new Error('Foto do equipamento inválida ou acima de 2 MB.');
  const processed = await sharp(source, { limitInputPixels: 25000000 }).rotate().resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const hash = crypto.createHash('sha256').update(processed.data).digest('hex');
  return withTransaction(async execute => {
    await execute('SELECT id FROM material_identification_lock WHERE id=1' + lockRow);
    const material = (await execute('SELECT id,foto_url FROM materiais WHERE id=?' + lockRow, [materialId]))[0];
    if (!material) throw new Error('Material não encontrado.');
    let photo = await queryOne('SELECT arquivo FROM material_fotos WHERE sha256=?', [hash]);
    if (!photo) {
      photo = { arquivo: crypto.randomUUID() + '.webp' };
      await execute('INSERT INTO material_fotos (arquivo,sha256,imagem_base64,tamanho,largura,altura,responsavel_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [photo.arquivo, hash, processed.data.toString('base64'), processed.data.length, processed.info.width, processed.info.height, userId, new Date().toISOString()]);
    }
    const url = '/api/materiais/fotos/' + photo.arquivo;
    await execute('UPDATE materiais SET foto_url=?,updated_at=? WHERE id=?', [url, new Date().toISOString(), materialId]);
    await audit(userId, 'FOTO_EQUIPAMENTO', 'material', materialId, { anterior: material.foto_url, foto_url: url }, execute);
    return { foto_url: url };
  });
}
