"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyBankCols = void 0;
// The bank account printed on letters. The Company screen keeps accounts in company_bank_accounts (one primary);
// the single bank_* columns on companies are the old place. The primary account wins, the old columns are the fallback.
const primary = (co, col) => `(SELECT b.${col} FROM company_bank_accounts b WHERE b.company_id = ${co}.id AND b.is_active = true ORDER BY b.is_primary DESC, b.created_at LIMIT 1)`;
// Five columns to put in a SELECT that has the companies table under the alias `co`
const companyBankCols = (co = 'c') => `
  COALESCE(${primary(co, 'account_name')}, NULLIF(${co}.bank_company_name, ''), ${co}.name) AS bank_company_name,
  COALESCE(${primary(co, 'account_number')}, NULLIF(${co}.bank_account_no, '')) AS bank_account_no,
  COALESCE(${primary(co, 'ifsc_code')}, NULLIF(${co}.bank_ifsc, '')) AS bank_ifsc,
  COALESCE(${primary(co, 'bank_name')}, NULLIF(${co}.bank_name, '')) AS bank_name,
  COALESCE(${primary(co, 'branch')}, NULLIF(${co}.bank_branch, '')) AS bank_branch`;
exports.companyBankCols = companyBankCols;
//# sourceMappingURL=company-bank.js.map