export const OutboxCommandProcessing = {
  LOCK_BATCH_SIZE: 50,
  STALE_THRESHOLD_MINUTES: 5,
  MAX_ATTEMPTS: 10,
} as const;
