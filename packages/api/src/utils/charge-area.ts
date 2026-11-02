// A per-sqft charge is rate x one of the unit's areas. The charge says which (Calculate rate on); a charge made before this choice existed ('Old Area') and a blank use the carpet area, as before.
export const CHARGE_AREAS = ['Carpet Area', 'Super Area', 'Balcony Area', 'Plot Area'] as const;
export const chargeAreaSql = (charge: string, unit: string) =>
  `(CASE ${charge}.calculate_rate_type WHEN 'Super Area' THEN ${unit}.super_area_sqft WHEN 'Balcony Area' THEN ${unit}.balcony_area_sqft WHEN 'Plot Area' THEN (SELECT ut.plot_area FROM unit_types ut WHERE ut.id = ${unit}.unit_type_id) ELSE ${unit}.carpet_area_sqft END)`;

// A "% of basic" charge is a share of the unit's basic price. "after_discount" takes off the company inaugural discount and the dealer adjustment of the booking first.
export const PERCENT_BASES = ['basic', 'after_discount'] as const;
export const percentChargeBase = (basic: any, inaugural: any, dealer: any, basis: string) =>
  Math.max(0, Number(basic || 0) - (basis === 'after_discount' ? Number(inaugural || 0) + Number(dealer || 0) : 0));
export const percentChargeSql = (acm: string, unit: string, booking: string) =>
  `ROUND(${acm}.percent_value / 100 * GREATEST(0, COALESCE(${unit}.base_price_inr, 0) - CASE WHEN ${acm}.percent_basis = 'after_discount' THEN COALESCE(${booking}.company_inaugural_disc, 0) + COALESCE(${booking}.dealer_adjustment_amount, 0) ELSE 0 END), 2)`;
