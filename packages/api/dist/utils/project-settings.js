"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balconyTerms = exports.projectSettings = exports.DEFAULT_SETTINGS = void 0;
exports.DEFAULT_SETTINGS = { receipt_prefix: null, receipt_number_mode: 'Automatic', registration_prefix: null, registration_number_mode: 'Automatic', registration_number_size: 4, balcony_max_charge_inr: null, balcony_max_area_sqft: null };
// A project with no settings row numbers as before: REC-<year>-00001 receipts, <4 letters of the name>-<year>-0001 registrations
const projectSettings = async (c, projectId) => projectId ? (await c.query('SELECT receipt_prefix, receipt_number_mode, registration_prefix, registration_number_mode, registration_number_size, balcony_max_charge_inr::float8, balcony_max_area_sqft::float8 FROM project_settings WHERE project_id = $1', [projectId])).rows[0] ?? exports.DEFAULT_SETTINGS : exports.DEFAULT_SETTINGS;
exports.projectSettings = projectSettings;
// Balcony charge = MIN(chargeable area x rate, cap). Rate comes from the Charge Master; the project may limit the area charged and/or the amount (its own cap wins over the Charge Master's)
const balconyTerms = async (c, projectId) => {
    const g = (await c.query(`SELECT rate_value, cap_value FROM charge_master_config WHERE charge_key = 'balcony_charge'`)).rows[0];
    const s = await (0, exports.projectSettings)(c, projectId);
    return { rate: parseFloat(g?.rate_value || 0), cap: s.balcony_max_charge_inr ?? (g?.cap_value != null ? parseFloat(g.cap_value) : null), maxArea: s.balcony_max_area_sqft };
};
exports.balconyTerms = balconyTerms;
//# sourceMappingURL=project-settings.js.map