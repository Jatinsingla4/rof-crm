"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classificationOk = classificationOk;
const index_js_1 = require("../index.js");
const input_js_1 = require("./input.js");
const applicant_js_1 = require("./applicant.js");
// A project that has its own Customer Classification list accepts only those names; a project with none keeps the standard EWS / LIG / MIG
async function classificationOk(projectId, value) {
    if (value == null || value === '')
        return;
    const own = projectId ? (await index_js_1.db.query('SELECT name FROM customer_classifications WHERE project_id = $1', [projectId])).rows.map((r) => r.name) : [];
    const allowed = own.length ? own : applicant_js_1.INCOME_CATS;
    if (!allowed.includes(value))
        throw (0, input_js_1.bad)(`Customer classification must be one of ${allowed.join(', ')}`);
}
//# sourceMappingURL=classification.js.map