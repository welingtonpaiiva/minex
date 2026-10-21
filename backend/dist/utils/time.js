"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duration = exports.elapsed = exports.now = void 0;
exports.instant = instant;
exports.today = today;
exports.dayBoundary = dayBoundary;
function instant(value) {
    if (value instanceof Date)
        return value.getTime();
    if (/[zZ]$|[+-]\d\d:\d\d$/.test(value))
        return new Date(value).getTime();
    const mysql = (process.env.DB_CLIENT || (process.env.MYSQL_HOST ? 'mysql' : 'sqlite')) === 'mysql';
    const offset = mysql ? 'Z' : (process.env.LEGACY_TIME_OFFSET || '-03:00');
    return new Date(value.replace(' ', 'T') + offset).getTime();
}
const now = () => new Date().toISOString();
exports.now = now;
const elapsed = (date) => Math.max(0, Math.floor((Date.now() - instant(date)) / 60000));
exports.elapsed = elapsed;
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
exports.duration = duration;
function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo' }).format(new Date()); }
function dayBoundary(value, end = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)
        throw new Error('Data de filtro inválida');
    return new Date(value + (end ? 'T23:59:59.999' : 'T00:00:00.000') + (process.env.LEGACY_TIME_OFFSET || '-03:00')).toISOString();
}
