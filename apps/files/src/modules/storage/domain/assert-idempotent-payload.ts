import { IdempotencyConflictException } from './errors';

export function assertIdempotentPayload(
  storedPayloadHash: string,
  incomingPayloadHash: string,
): void {
  if (storedPayloadHash !== incomingPayloadHash) {
    throw new IdempotencyConflictException();
  }
}
