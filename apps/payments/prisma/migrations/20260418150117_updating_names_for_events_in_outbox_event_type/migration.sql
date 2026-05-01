-- 1. Переименовать старый enum
ALTER TYPE "OutboxEventType" RENAME TO "OutboxEventType_old";

-- 2. Перевести колонку в TEXT
ALTER TABLE "outbox_events"
ALTER COLUMN "type"
TYPE text
USING "type"::text;

-- 3. Обновить данные (маппинг)
UPDATE "outbox_events"
SET "type" = CASE
                 WHEN "type" = 'PAYMENT_COMPLETED' THEN 'SUBSCRIPTION_ACTIVATED'
                 WHEN "type" = 'PAYMENT_FAILED' THEN 'SUBSCRIPTION_RENEWAL_FAILED'
                 ELSE "type"
    END;

-- 4. Создать новый enum
CREATE TYPE "OutboxEventType" AS ENUM (
  'SUBSCRIPTION_ACTIVATED',
  'CHECKOUT_SESSION_EXPIRED',
  'SUBSCRIPTION_RENEWAL_FAILED'
);

-- 5. Перевести обратно в enum
ALTER TABLE "outbox_events"
ALTER COLUMN "type"
TYPE "OutboxEventType"
USING "type"::"OutboxEventType";

-- 6. Удалить старый enum
DROP TYPE "OutboxEventType_old";