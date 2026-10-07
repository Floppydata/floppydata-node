import type { ApiError, ApiErrorCode } from './gen/types.gen.js';

type ApiErrorBody = ApiError['error'];

/**
 * Thrown when the API answers with a non-2xx status.
 *
 * `code` is one of the documented {@link ApiErrorCode} values, or
 * `'unknown_error'` when the response was not a Floppydata JSON error
 * (for example an HTML page from a proxy in between).
 * Network failures are not wrapped: they surface as the original `fetch` error.
 */
export class FloppyDataError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'unknown_error';
  readonly details: ApiErrorBody['details'];
  /** The raw response body: parsed JSON when possible, otherwise text. */
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const apiError = isApiError(body) ? body.error : undefined;
    super(
      apiError
        ? `${apiError.code}: ${apiError.message}`
        : `Floppydata API request failed with HTTP ${status}`,
    );
    this.name = 'FloppyDataError';
    this.status = status;
    this.code = apiError?.code ?? 'unknown_error';
    this.details = apiError?.details ?? {};
    this.body = body;
  }
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
