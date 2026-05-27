/**
 * Рекомендуемые метрики Prometheus для воркеров inbox / outbox-command в payments.
 * Подключение — отдельная задача на monitoring stack (дашборды Grafana + алерты).
 */
export const PaymentsRecommendedMetrics = {
  /** Gauge: число записей inbox_events со статусом PENDING */
  INBOX_EVENTS_PENDING_COUNT: 'inbox_events_pending_count',

  /** Gauge: число записей inbox_events со статусом FAILED */
  INBOX_EVENTS_FAILED_COUNT: 'inbox_events_failed_count',

  /** Histogram: время от блокировки до PROCESSED для одного inbox-события (мс) */
  INBOX_EVENT_PROCESSING_DURATION_MS: 'inbox_event_processing_duration_ms',

  /** Gauge: число записей outbox_commands со статусом PENDING */
  OUTBOX_COMMANDS_PENDING_COUNT: 'outbox_commands_pending_count',

  /** Gauge: число записей outbox_commands со статусом FAILED */
  OUTBOX_COMMANDS_FAILED_COUNT: 'outbox_commands_failed_count',

  /** Histogram: время от блокировки до PROCESSED для одной outbox-команды (мс) */
  OUTBOX_COMMAND_PROCESSING_DURATION_MS: 'outbox_command_processing_duration_ms',
} as const;

/**
 * Пороги для алертов (отдельная задача на monitoring stack):
 * - inbox_events_pending_count > 0 дольше 15 минут
 * - inbox_events_failed_count > 0
 * - outbox_commands_pending_count > 0 и самая старая created_at > 1 ч (риск по TTL Idempotency-Key в Stripe)
 * - outbox_commands со статусом FAILED после исчерпания MAX_ATTEMPTS
 */
