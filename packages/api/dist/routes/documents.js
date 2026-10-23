"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Documents Routes - Module E
 * Template engine, PDF generation, scanned contract vault, document management.
 * Split by job: templates.ts (letter templates), generate.ts (+ merge-demand.ts for demand letters and interest, merge-letters.ts for the other letters),
 * vault.ts (send, search, list, scanned vault, delete), edit.ts (field edits, recalculation, versions, HTML page). Routes keep their old order.
 */
const express_1 = require("express");
const templates_js_1 = __importDefault(require("./documents/templates.js"));
const generate_js_1 = __importDefault(require("./documents/generate.js"));
const vault_js_1 = __importDefault(require("./documents/vault.js"));
const edit_js_1 = __importDefault(require("./documents/edit.js"));
const router = (0, express_1.Router)();
router.use(templates_js_1.default);
router.use(generate_js_1.default);
router.use(vault_js_1.default);
router.use(edit_js_1.default);
exports.default = router;
//# sourceMappingURL=documents.js.map