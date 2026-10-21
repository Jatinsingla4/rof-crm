"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextReceiptNumber = void 0;
const input_js_1 = require("./input.js");
// Next running receipt number, REC-<year>-00001. Numbers that already exist (old random ones) are skipped.
const nextReceiptNumber = async (c, suffix = '') => {
    for (let i = 0; i < 50; i++) {
        const n = (await c.query(`SELECT nextval('receipt_number_seq') AS n`)).rows[0].n;
        const num = `REC-${new Date().getFullYear()}-${String(n).padStart(5, '0')}${suffix}`;
        if (!(await c.query(`SELECT 1 FROM receipts WHERE receipt_number = $1`, [num])).rows.length)
            return num;
    }
    throw (0, input_js_1.bad)('Could not allocate a receipt number, please try again', 503);
};
exports.nextReceiptNumber = nextReceiptNumber;
//# sourceMappingURL=receipt-number.js.map