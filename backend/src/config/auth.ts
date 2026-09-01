import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'casa_da_lanterna_secret_key_2026_industrial_pdv';
export const JWT_EXPIRES_IN = '12h';
