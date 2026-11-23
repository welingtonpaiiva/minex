"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTerm = searchTerm;
exports.searchColumn = searchColumn;
const db_1 = require("../config/db");
function searchTerm(value) {
    return '%' + String(value || '').trim().slice(0, 255).toLowerCase() + '%';
}
// SQLite's LOWER only converts ASCII; also fold Portuguese accented capitals.
// MySQL/TiDB handles Unicode with LOWER, even with a binary column collation.
function searchColumn(column) {
    let expression = column;
    if (db_1.databaseClient === 'sqlite') {
        for (const letter of 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ') {
            expression = `REPLACE(${expression}, '${letter}', '${letter.toLowerCase()}')`;
        }
    }
    return `LOWER(${expression})`;
}
