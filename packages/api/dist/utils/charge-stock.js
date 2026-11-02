"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStock = exports.chargeStock = exports.lockCharges = exports.stockUsedSql = void 0;
// Stock of an inventory-based charge (the client's parking): "Quantity" on the charge is how many exist, and each one given to a unit or a customer uses one.
// Used = what units carry in advance (their quantities) + customer charges whose unit carries no such row (a Mandatory charge, or one added to a customer by hand, one each).
const stockUsedSql = (m) => `((SELECT COALESCE(SUM(uac.quantity), 0) FROM unit_addon_charges uac WHERE uac.charge_master_id = ${m}.id)
    + (SELECT COUNT(*) FROM consumer_addon_charges cac WHERE cac.charge_master_id = ${m}.id AND cac.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM booking_records br JOIN unit_addon_charges uac2 ON uac2.unit_id = br.unit_id AND uac2.charge_master_id = ${m}.id
                         WHERE br.consumer_id = cac.consumer_id AND br.status != 'cancelled')))`;
exports.stockUsedSql = stockUsedSql;
const conflict = (message) => Object.assign(new Error(message), { http: 409 });
// Locks the charges (in a fixed order, so two requests cannot wait on each other) before their stock is read
const lockCharges = async (c, ids) => { if (ids.length)
    await c.query('SELECT id FROM addon_charge_master WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]); };
exports.lockCharges = lockCharges;
const chargeStock = async (c, masterId) => {
    const r = (await c.query(`SELECT m.charge_name, m.quantity AS stock, m.inventory_base, ${(0, exports.stockUsedSql)('m')} AS used FROM addon_charge_master m WHERE m.id = $1`, [masterId])).rows[0];
    if (!r)
        return null;
    return { name: r.charge_name, stock: r.inventory_base && r.stock != null ? Number(r.stock) : null, used: Number(r.used) };
};
exports.chargeStock = chargeStock;
// Throws a 409 when the stock is passed. more = 0 checks what is already given out (after a unit was given its pieces); more = 1 asks whether one more piece is left
const requireStock = async (c, masterId, more = 0) => {
    const s = await (0, exports.chargeStock)(c, masterId);
    if (!s || s.stock === null || s.used + more <= s.stock)
        return;
    throw conflict(more > 0
        ? `"${s.name}" has no piece left: all ${s.stock} are given out.`
        : `"${s.name}" is limited to ${s.stock}, and this would give out ${s.used}. Lower the quantity or raise the stock in Other Charges.`);
};
exports.requireStock = requireStock;
//# sourceMappingURL=charge-stock.js.map