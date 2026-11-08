import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RE_VOTE_NOT_ALLOWED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'PAYMENT_STATE_CONFLICT'
  | 'INVENTORY_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'DEPENDENCY_UNAVAILABLE';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  RE_VOTE_NOT_ALLOWED: HttpStatus.CONFLICT,
  QUOTA_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PAYMENT_STATE_CONFLICT: HttpStatus.CONFLICT,
  INVENTORY_UNAVAILABLE: HttpStatus.CONFLICT,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  DEPENDENCY_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Ground rule 8: bugs (INTERNAL_ERROR) and typed dependency degradation never mix. */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: number = STATUS[code],
  ) {
    super({ code, message }, status);
  }
}

export function dependencyUnavailable(message = 'dependency unavailable'): ApiException {
  return new ApiException('DEPENDENCY_UNAVAILABLE', message);
}
