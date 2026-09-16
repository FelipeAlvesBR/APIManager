import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../config.js";
import { newId } from "@apiplatform/shared";

export interface AuthClaims extends JwtPayload {
  sub: string;
  tv: number;
}

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { tv: tokenVersion },
    config.jwtSecret,
    { subject: userId, jwtid: newId("jti"), expiresIn: config.jwtTtl as unknown as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyToken(token: string): AuthClaims {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthClaims;
    return decoded;
  } catch {
    throw Object.assign(new Error("Invalid or expired token"), { status: 401 });
  }
}