"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notCreator = void 0;
// Strict maker-checker rule (plan 5.4): the person who created a record can never act as its checker, for every role including
// super_admin, and a record whose creator is unknown blocks the action until it is remediated. No flag, header or role bypasses it.
// Helper only for now; the financial routes still use notOwn until they are moved over.
const refuse = (message, http) => Object.assign(new Error(message), { http });
const notCreator = (req, creatorId) => {
    if (!req.userId)
        throw refuse('Not authenticated', 403);
    if (!creatorId)
        throw refuse('The creator of this record is unknown, so it needs remediation before anyone can act on it', 409);
    if (creatorId === req.userId)
        throw refuse('You created this yourself, someone else has to act on it', 403);
};
exports.notCreator = notCreator;
//# sourceMappingURL=not-creator.js.map