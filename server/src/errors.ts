/**
 * The error vocabulary the client already understands.
 *
 * These codes match `ApiErrorCode` in the app, so a failure crosses the wire without the
 * client having to translate anything — the screens that already distinguish "slot taken"
 * from "hold expired" keep working unchanged.
 */
export type ApiErrorCode =
  | 'slot_taken'
  | 'hold_expired'
  | 'not_found'
  | 'payment_failed'
  | 'not_played'
  | 'already_reviewed'
  | 'already_open'
  | 'not_a_captain'
  | 'validation'
  | 'network';

const STATUS: Record<ApiErrorCode, number> = {
  slot_taken: 409,
  hold_expired: 410,
  not_found: 404,
  payment_failed: 402,
  not_played: 409,
  already_reviewed: 409,
  already_open: 409,
  not_a_captain: 403,
  validation: 400,
  network: 503,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
  }
}
