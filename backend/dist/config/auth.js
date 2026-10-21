"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_EXPIRES_IN = exports.JWT_SECRET = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
function secret() {
    if (process.env.JWT_SECRET) {
        if (process.env.JWT_SECRET.length < 32)
            throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');
        return process.env.JWT_SECRET;
    }
    if (process.env.NODE_ENV === 'production')
        throw new Error('Configure JWT_SECRET em produção');
    const folder = path_1.default.resolve(__dirname, '../../.runtime');
    const file = path_1.default.join(folder, 'jwt-secret');
    fs_1.default.mkdirSync(folder, { recursive: true });
    if (!fs_1.default.existsSync(file))
        fs_1.default.writeFileSync(file, crypto_1.default.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
    return fs_1.default.readFileSync(file, 'utf8').trim();
}
exports.JWT_SECRET = secret();
exports.JWT_EXPIRES_IN = '12h';
