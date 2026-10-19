/**
 * Turns common PostgreSQL errors into client errors (400 or 409) instead of a generic 500.
 * Mount it at the end of a router: router.use(pgErrorHandler)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../index.js';

export const pgErrorHandler = (err: any, req: AuthRequest, res: Response, next: NextFunction) => {
  switch (err?.code) {
    case '42501': return res.status(403).json({ error: 'This is outside the projects your login is assigned to' });
    case '23505': return res.status(409).json({ error: 'A record with the same value already exists' });
    case '23503':
      return req.method === 'DELETE'
        ? res.status(409).json({ error: 'This record is in use and cannot be deleted' })
        : res.status(400).json({ error: 'A referenced record does not exist' });
    case '23502': return res.status(400).json({ error: 'A required field is missing' });
    case '22021': return res.status(400).json({ error: 'Text contains characters that are not allowed' });
    case '22P02': return res.status(400).json({ error: 'Invalid value or id' });
    case '22001': return res.status(400).json({ error: 'A value is too long' });
    case '22003': return res.status(400).json({ error: 'A number is out of range' });
    case '22007':
    case '22008': return res.status(400).json({ error: 'Invalid date' });
    case '23514': return res.status(400).json({ error: 'A value is not allowed' });
    default: return next(err);
  }
};
