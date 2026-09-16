import type { PublicUser } from "../auth/service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
      tokenVersion?: number;
      requestStart?: number;
    }
  }
}

export {}