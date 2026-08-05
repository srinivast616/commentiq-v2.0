import { Request, Response, NextFunction } from "express";

// Simple in-memory sliding-window rate limiter, keyed by user ID (falls back
// to IP for unauthenticated routes). Good enough for an MVP single-instance
// deployment; swap for a Redis-backed limiter once the API runs on more than
// one instance.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const key = req.userId ?? req.ip ?? "anonymous";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: { code: "rate_limited", message: `Too many requests, retry in ${retryAfterSec}s` },
      });
    }

    bucket.count += 1;
    next();
  };
}
