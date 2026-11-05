"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePrintAndDownload = exports.requireDownload = exports.requirePrint = void 0;
const superAdmin_js_1 = require("./superAdmin.js");
const deny = (res, what) => res.status(403).json({ error: `${what} is not enabled for your login. Ask a super admin.` });
const requirePrint = (req, res, next) => ((0, superAdmin_js_1.isSuperAdmin)(req) || req.authorizedPrint === true ? next() : deny(res, 'Printing'));
exports.requirePrint = requirePrint;
const requireDownload = (req, res, next) => ((0, superAdmin_js_1.isSuperAdmin)(req) || req.authorizedDownload === true ? next() : deny(res, 'Downloading'));
exports.requireDownload = requireDownload;
// A response that is both a printable page and a file (a PDF) needs both grants
const requirePrintAndDownload = (req, res, next) => (0, superAdmin_js_1.isSuperAdmin)(req) || (req.authorizedPrint === true && req.authorizedDownload === true) ? next() : deny(res, 'Printing and downloading');
exports.requirePrintAndDownload = requirePrintAndDownload;
//# sourceMappingURL=printDownload.js.map