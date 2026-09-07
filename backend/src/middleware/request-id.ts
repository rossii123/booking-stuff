import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Every response carries X-Request-Id so a user-reported error can be matched to
 * a log line. An incoming id (from a proxy/frontend) is honoured so one id spans
 * the whole hop chain. (Interview topic: stability / observability.)
 */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    const id = incoming && /^[\w.-]{1,128}$/.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
