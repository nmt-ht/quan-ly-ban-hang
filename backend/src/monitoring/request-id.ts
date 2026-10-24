import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Gives every request an id (the caller's X-Request-Id when it is a sane token, else a new UUID), echoes it
 * in the response header and stores it on `req.id`. The Nhật ký hoạt động line, the error log and Sentry all
 * carry it, so one id finds a request across all three.
 */
export function requestId(req: Request & { id?: string }, res: Response, next: NextFunction): void {
  const given = req.header('x-request-id');
  req.id = given && /^[\w.-]{8,64}$/.test(given) ? given : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
