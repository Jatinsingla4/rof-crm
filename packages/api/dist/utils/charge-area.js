"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chargeAreaSql = exports.CHARGE_AREAS = void 0;
// A per-sqft charge is rate x one of the unit's areas. The charge says which (Calculate rate on); a charge made before this choice existed ('Old Area') and a blank use the carpet area, as before.
exports.CHARGE_AREAS = ['Carpet Area', 'Super Area', 'Balcony Area', 'Plot Area'];
const chargeAreaSql = (charge, unit) => `(CASE ${charge}.calculate_rate_type WHEN 'Super Area' THEN ${unit}.super_area_sqft WHEN 'Balcony Area' THEN ${unit}.balcony_area_sqft WHEN 'Plot Area' THEN (SELECT ut.plot_area FROM unit_types ut WHERE ut.id = ${unit}.unit_type_id) ELSE ${unit}.carpet_area_sqft END)`;
exports.chargeAreaSql = chargeAreaSql;
//# sourceMappingURL=charge-area.js.map