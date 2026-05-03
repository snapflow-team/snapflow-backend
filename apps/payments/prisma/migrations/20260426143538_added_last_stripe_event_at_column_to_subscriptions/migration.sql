-- =========================================
-- Add column last_stripe_event_at
-- =========================================
ALTER TABLE "subscriptions"
    ADD COLUMN "last_stripe_event_at" TIMESTAMP;