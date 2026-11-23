import { databaseClient } from '../config/db';

export function searchTerm(value: unknown): string {
  return '%' + String(value || '').trim().slice(0, 255).toLowerCase() + '%';
}

// SQLite's LOWER only converts ASCII; also fold Portuguese accented capitals.
// MySQL/TiDB handles Unicode with LOWER, even with a binary column collation.
export function searchColumn(column: string): string {
  let expression = column;
  if (databaseClient === 'sqlite') {
    for (const letter of 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ') {
      expression = `REPLACE(${expression}, '${letter}', '${letter.toLowerCase()}')`;
    }
  }
  return `LOWER(${expression})`;
}
