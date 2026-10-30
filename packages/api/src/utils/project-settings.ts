type Q = { query: (sql: string, p?: any[]) => Promise<any> };
export type ProjectSettings = { receipt_prefix: string | null; receipt_number_mode: 'Automatic' | 'Manual'; registration_prefix: string | null; registration_number_mode: 'Automatic' | 'Manual'; registration_number_size: number };
export const DEFAULT_SETTINGS: ProjectSettings = { receipt_prefix: null, receipt_number_mode: 'Automatic', registration_prefix: null, registration_number_mode: 'Automatic', registration_number_size: 4 };
// A project with no settings row numbers as before: REC-<year>-00001 receipts, <4 letters of the name>-<year>-0001 registrations
export const projectSettings = async (c: Q, projectId: string | null | undefined): Promise<ProjectSettings> =>
  projectId ? (await c.query('SELECT receipt_prefix, receipt_number_mode, registration_prefix, registration_number_mode, registration_number_size FROM project_settings WHERE project_id = $1', [projectId])).rows[0] ?? DEFAULT_SETTINGS : DEFAULT_SETTINGS;
