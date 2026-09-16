import type { NextFunction, Request, Response } from "express";
import { ApiError, newId } from "@apiplatform/shared";
import { verifyToken } from "../auth/token.js";
import { assertActiveUser, getUserById, toPublicUser } from "../auth/service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(ApiError.unauthorized("Missing bearer token"));
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  let claims;
  try {
    claims = verifyToken(token);
  } catch {
    next(ApiError.unauthorized("Invalid or expired token"));
    return;
  }
  const user = assertActiveUser(getUserById(claims.sub));
  if (claims.tv !== user.token_version) {
    next(ApiError.unauthorized("Token has been revoked"));
    return;
  }
  req.user = toPublicUser(user);
  req.tokenVersion = user.token_version;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    try {
      const claims = verifyToken(token);
      const user = assertActiveUser(getUserById(claims.sub));
      if (claims.tv === user.token_version) {
        req.user = toPublicUser(user);
        req.tokenVersion = user.token_version;
      }
    } catch {
      /* ignore */
    }
  }
  next();
}

export { newId };