-- =========================================
-- Make stripe_cus_id nullable
-- =========================================
ALTER TABLE "customers"
    ALTER COLUMN "stripe_cus_id" DROP NOT NULL;
