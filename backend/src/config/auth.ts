import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function secret() {
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Configure JWT_SECRET em produção');
  const folder = path.resolve(__dirname, '../../.runtime');
  const file = path.join(folder, 'jwt-secret');
  fs.mkdirSync(folder, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}
export const JWT_SECRET = secret();
export const JWT_EXPIRES_IN = '12h';
