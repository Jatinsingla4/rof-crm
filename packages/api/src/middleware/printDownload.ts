// Print and download are application workflow permissions (plan 8.1): the backend refuses the application's own print, export and file
// endpoints to a login that was not granted them. super_admin passes; false, NULL or missing deny. Buttons hidden in the browser are
// usability only; these gates are the control (they also cover the ?token= link routes, which pass through the same authentication).
// They do not stop screenshots, copying text or retyping data a login may read.
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../index.js';
import { isSuperAdmin } from './superAdmin.js';

type Who = AuthRequest;
const deny = (res: Response, what: string) => res.status(403).json({ error: `${what} is not enabled for your login. Ask a super admin.` });

export const requirePrint = (req: Who, res: Response, next: NextFunction) => (isSuperAdmin(req) || req.authorizedPrint === true ? next() : deny(res, 'Printing'));
export const requireDownload = (req: Who, res: Response, next: NextFunction) => (isSuperAdmin(req) || req.authorizedDownload === true ? next() : deny(res, 'Downloading'));
// A response that is both a printable page and a file (a PDF) needs both grants
export const requirePrintAndDownload = (req: Who, res: Response, next: NextFunction) =>
  isSuperAdmin(req) || (req.authorizedPrint === true && req.authorizedDownload === true) ? next() : deny(res, 'Printing and downloading');
