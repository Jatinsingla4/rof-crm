import { bad } from './input.js';
import { projectSettings } from './project-settings.js';

// Next running receipt number, REC-<year>-00001. Numbers that already exist (old random ones) are skipped.
export const nextReceiptNumber = async (c: { query: (sql: string, p?: any[]) => Promise<any> }, suffix = '', projectId?: string | null): Promise<string> => {
  const prefix = (await projectSettings(c, projectId)).receipt_prefix || 'REC';
  for (let i = 0; i < 50; i++) {
    const n = (await c.query(`SELECT nextval('receipt_number_seq') AS n`)).rows[0].n;
    const num = `${prefix}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}${suffix}`;
    if (!(await c.query(`SELECT 1 FROM receipts WHERE receipt_number = $1`, [num])).rows.length) return num;
  }
  throw bad('Could not allocate a receipt number, please try again', 503);
};
