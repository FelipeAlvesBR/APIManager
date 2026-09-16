import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@apiplatform/shared";
import { config } from "../config.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || "anonymous";
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + config.rateLimit.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader("X-RateLimit-Limit", String(config.rateLimit.max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, config.rateLimit.max - bucket.count)));
  if (bucket.count > config.rateLimit.max) {
    next(new ApiError("RATE_LIMITED", 429, "Rate limit exceeded"));
    return;
  }
  next();
}

// Clear rate-limit buckets periodically in long-running server processes.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, config.rateLimit.windowMs).unref();