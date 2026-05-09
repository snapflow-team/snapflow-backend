-- =========================================
-- Add SUBSCRIPTION_RENEWED to OutboxEventType
-- =========================================
ALTER TYPE "OutboxEventType"
    ADD VALUE 'SUBSCRIPTION_RENEWED';
