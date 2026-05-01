-- =========================================
-- 1. Rename old enum
-- =========================================
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";

-- =========================================
-- 2. DROP DEFAULT (ВАЖНО)
-- =========================================
ALTER TABLE "subscriptions"
    ALTER COLUMN "status" DROP DEFAULT;

-- =========================================
-- 3. Convert column to TEXT
-- =========================================
ALTER TABLE "subscriptions"
ALTER COLUMN "status"
TYPE text
USING "status"::text;

-- =========================================
-- 4. Data migration
-- =========================================
UPDATE "subscriptions"
SET "status" = CASE
                   WHEN "status" = 'EXPIRED' THEN 'PAST_DUE'
                   ELSE "status"
    END;

-- =========================================
-- 5. Create new enum
-- =========================================
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'CANCELLED',
  'PAST_DUE',
  'PENDING'
);

-- =========================================
-- 6. Convert back to enum
-- =========================================
ALTER TABLE "subscriptions"
ALTER COLUMN "status"
TYPE "SubscriptionStatus"
USING "status"::"SubscriptionStatus";

-- =========================================
-- 7. Restore DEFAULT
-- =========================================
ALTER TABLE "subscriptions"
    ALTER COLUMN "status"
        SET DEFAULT 'PENDING';

-- =========================================
-- 8. Drop old enum
-- =========================================
DROP TYPE "SubscriptionStatus_old";