import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError, newId } from "@apiplatform/shared";
import { logger, redact } from "../logger.js";

/** Wrap an async handler so rejected promises flow to the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  req.requestStart = performance.now();
  const requestId = newId("reqid");
  req.headers["x-request-id"] = String(req.headers["x-request-id"] ?? requestId);
  res.setHeader("X-Request-Id", req.headers["x-request-id"]);
  next();
}

export function notFoundHandler(req: Request, res: Response): void {
  const err = ApiError.notFound(`No route for ${req.method} ${req.path}`);
  sendError(req, res, err);
  void req;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    void _next;
    return;
  }
  const apiError = normalizeError(err, req);
  sendError(req, res, apiError);
}

function normalizeError(err: unknown, req: Request): ApiError {
  let code = "INTERNAL";
  let status = 500;
  let message = "Unexpected server error";
  let details: unknown;

  if (err instanceof ApiError) {
    code = err.code;
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err instanceof SyntaxError && "body" in Object(err)) {
    code = "BAD_REQUEST";
    status = 400;
    message = "Malformed JSON body";
  } else if (err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number") {
    status = (err as { status: number }).status;
    message = err.message;
    code = statusToCode(status);
  } else if (err instanceof Error) {
    message = err.message;
  }

  logger.error("request error", {
    requestId: req.headers["x-request-id"],
    method: req.method,
    path: redact(req.originalUrl),
    code,
    status,
    message,
  });

  return new ApiError(code as ApiError["code"], status, message, details);
}

function statusToCode(status: number): ApiError["code"] {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL";
}

function sendError(req: Request, res: Response, err: ApiError): void {
  const requestId = req.headers["x-request-id"];
  const errorPayload: Record<string, unknown> = {
    code: err.code,
    message: err.message,
    requestId,
  };
  if (err.details !== undefined) errorPayload.details = err.details;
  res.status(err.status).json({ error: errorPayload });
}