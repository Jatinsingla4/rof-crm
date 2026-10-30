"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSettings = exports.DEFAULT_SETTINGS = void 0;
exports.DEFAULT_SETTINGS = { receipt_prefix: null, receipt_number_mode: 'Automatic', registration_prefix: null, registration_number_mode: 'Automatic', registration_number_size: 4 };
// A project with no settings row numbers as before: REC-<year>-00001 receipts, <4 letters of the name>-<year>-0001 registrations
const projectSettings = async (c, projectId) => projectId ? (await c.query('SELECT receipt_prefix, receipt_number_mode, registration_prefix, registration_number_mode, registration_number_size FROM project_settings WHERE project_id = $1', [projectId])).rows[0] ?? exports.DEFAULT_SETTINGS : exports.DEFAULT_SETTINGS;
exports.projectSettings = projectSettings;
//# sourceMappingURL=project-settings.js.map