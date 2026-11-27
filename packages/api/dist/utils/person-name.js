"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personNameSql = void 0;
// ONE way to show an applicant's name in SQL results (QA-022, V1.1): the first and last name as stored, the NOT NULL `name` column when they are empty. Seven other forms were in use:
// some read `name` first, some added the salutation, and three returned NULL whenever first_name was NULL (first_name || ' ' || last_name). `a` is the consumers alias.
// The write side (utils/applicant-fields.ts personName) is what keeps `name` and the parts in step.
const personNameSql = (a = 'c') => `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ${a}.first_name, ${a}.last_name)), ''), ${a}.name)`;
exports.personNameSql = personNameSql;
//# sourceMappingURL=person-name.js.map