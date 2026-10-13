export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorPayload;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
