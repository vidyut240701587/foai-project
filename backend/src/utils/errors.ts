export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const createErrorResponse = (code: string, message: string, details?: Record<string, unknown>) => ({
  success: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});
