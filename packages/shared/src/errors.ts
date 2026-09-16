export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TOO_LARGE"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Unique identifier for correlating logs with a client-visible error. */
  readonly requestId?: string;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError("BAD_REQUEST", 400, message, details);
  }
  static unauthorized(message = "Unauthorized", details?: unknown): ApiError {
    return new ApiError("UNAUTHORIZED", 401, message, details);
  }
  static forbidden(message = "Forbidden", details?: unknown): ApiError {
    return new ApiError("FORBIDDEN", 403, message, details);
  }
  static notFound(message = "Not found", details?: unknown): ApiError {
    return new ApiError("NOT_FOUND", 404, message, details);
  }
  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError("CONFLICT", 409, message, details);
  }
  static tooLarge(message = "Request too large", details?: unknown): ApiError {
    return new ApiError("TOO_LARGE", 413, message, details);
  }
  static internal(message = "Internal error", details?: unknown): ApiError {
    return new ApiError("INTERNAL", 500, message, details);
  }
}

export interface HttpStatusEx {
  code: number;
  phrase: string;
}

export const STATUS_PHRASES: Record<number, string> = {
  100: "Continue",
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  426: "Upgrade Required",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export function statusPhrase(code: number): string {
  return STATUS_PHRASES[code] ?? "Unknown";
}

export function classifyStatus(code: number): "success" | "redirect" | "clientError" | "serverError" | "none" {
  if (!Number.isFinite(code)) return "none";
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "redirect";
  if (code >= 400 && code < 500) return "clientError";
  if (code >= 500) return "serverError";
  return "none";
}