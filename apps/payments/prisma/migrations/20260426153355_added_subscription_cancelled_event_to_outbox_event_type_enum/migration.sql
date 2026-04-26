-- =========================================
-- Add new value to OutboxEventType enum
-- =========================================
ALTER TYPE "OutboxEventType"
    ADD VALUE 'SUBSCRIPTION_CANCELLED';
