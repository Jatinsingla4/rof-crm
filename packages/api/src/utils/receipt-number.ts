import { bad } from './input.js';

// Next running receipt number, REC-<year>-00001. Numbers that already exist (old random ones) are skipped.
export const nextReceiptNumber = async (c: { query: (sql: string, p?: any[]) => Promise<any> }, suffix = ''): Promise<string> => {
  for (let i = 0; i < 50; i++) {
    const n = (await c.query(`SELECT nextval('receipt_number_seq') AS n`)).rows[0].n;
    const num = `REC-${new Date().getFullYear()}-${String(n).padStart(5, '0')}${suffix}`;
    if (!(await c.query(`SELECT 1 FROM receipts WHERE receipt_number = $1`, [num])).rows.length) return num;
  }
  throw bad('Could not allocate a receipt number, please try again', 503);
};
