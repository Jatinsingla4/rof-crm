"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Applicant photos for <img> tags. The address holds a random id, as the old /uploads files did; nothing else is readable here.
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
router.get('/:kind/:id', async (req, res, next) => {
    try {
        const { kind, id } = req.params;
        if (!['consumer', 'co', 'addl'].includes(kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
            return res.status(404).end();
        const r = (await index_js_1.db.query(`SELECT content_type, data FROM applicant_photos WHERE kind = $1 AND owner_id = $2`, [kind, id])).rows[0];
        if (!r)
            return res.status(404).end();
        res.set({ 'Content-Type': r.content_type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300', 'Content-Security-Policy': "default-src 'none'" }).send(r.data);
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=photos.js.map