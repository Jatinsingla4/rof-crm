// The bank account printed on letters. The Company screen keeps accounts in company_bank_accounts (one primary);
// the single bank_* columns on companies are the old place. The primary account wins, the old columns are the fallback.
const primary = (co: string, col: string) =>
  `(SELECT b.${col} FROM company_bank_accounts b WHERE b.company_id = ${co}.id AND b.is_active = true ORDER BY b.is_primary DESC, b.created_at LIMIT 1)`;

// Five columns to put in a SELECT that has the companies table under the alias `co`
export const companyBankCols = (co = 'c') => `
  COALESCE(${primary(co, 'account_name')}, NULLIF(${co}.bank_company_name, ''), ${co}.name) AS bank_company_name,
  COALESCE(${primary(co, 'account_number')}, NULLIF(${co}.bank_account_no, '')) AS bank_account_no,
  COALESCE(${primary(co, 'ifsc_code')}, NULLIF(${co}.bank_ifsc, '')) AS bank_ifsc,
  COALESCE(${primary(co, 'bank_name')}, NULLIF(${co}.bank_name, '')) AS bank_name,
  COALESCE(${primary(co, 'branch')}, NULLIF(${co}.bank_branch, '')) AS bank_branch`;

// Who may read a full company bank account number. The same finance roles that already have the finance-only rule (`financeOnly` in utils/input.ts);
// every other role gets the last four digits. Letters and demand letters print the number on purpose (customers pay into it) and are limited
// to roles that can create documents, so they are not masked here.
export const SEES_FULL_ACCOUNT = ['super_admin', 'accounts_finance'];
export const maskAccount = (n: unknown) => { if (n == null) return n; const t = String(n); return t.length > 4 ? 'XXXX' + t.slice(-4) : t; };
// Masks `bank_account_no` and `account_number` on one row (or a list of rows) unless the role may see them in full
export const forRole = <T>(role: string | undefined, row: T): T => {
  if (!row || SEES_FULL_ACCOUNT.includes(role || '')) return row;
  const o: any = { ...(row as any) };
  if ('bank_account_no' in o) o.bank_account_no = maskAccount(o.bank_account_no);
  if ('account_number' in o) o.account_number = maskAccount(o.account_number);
  return o;
};
