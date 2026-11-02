"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typePrice = void 0;
// The price a unit gets from its unit type. "Per Area": the rate x the area the rate is charged on. "In Fix": the rate IS the price of the unit (a villa at a fixed price).
const typePrice = (t) => {
    if (!t || t.base_rate_sqft == null || t.base_rate_sqft === '')
        return null;
    if (t.rate_type === 'In Fix')
        return Math.round(Number(t.base_rate_sqft)) || null;
    const area = { 'Super Area': t.super_area_sqft, 'Carpet Area': t.carpet_area_sqft, 'Built Up Area': t.built_up_area_sqft, 'Plot Area': t.plot_area }[t.rate_basis];
    return area ? Math.round(Number(t.base_rate_sqft) * Number(area)) : null;
};
exports.typePrice = typePrice;
//# sourceMappingURL=unit-type-price.js.map