-- =========================================
-- Add next_payment_at to subscriptions
-- =========================================
ALTER TABLE "subscriptions"
ADD COLUMN "next_payment_at" TIMESTAMP;
