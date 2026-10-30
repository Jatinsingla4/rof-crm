import { db } from '../index.js';
import { bad } from './input.js';
import { INCOME_CATS } from './applicant.js';

// A project that has its own Customer Classification list accepts only those names; a project with none keeps the standard EWS / LIG / MIG
export async function classificationOk(projectId: string | null | undefined, value: any) {
  if (value == null || value === '') return;
  const own = projectId ? (await db.query('SELECT name FROM customer_classifications WHERE project_id = $1', [projectId])).rows.map((r: any) => r.name) : [];
  const allowed: string[] = own.length ? own : INCOME_CATS;
  if (!allowed.includes(value)) throw bad(`Customer classification must be one of ${allowed.join(', ')}`);
}
