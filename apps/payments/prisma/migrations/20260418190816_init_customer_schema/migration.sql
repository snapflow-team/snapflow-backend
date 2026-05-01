-- =========================================
-- 1. CREATE customers table
-- =========================================
CREATE TABLE "customers" (
    "id" SERIAL PRIMARY KEY,
    "stripe_cus_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL,
    "deleted_at" TIMESTAMP
);

-- index from Prisma
CREATE INDEX "customers_userId_idx"
    ON "customers" ("user_id");

-- =========================================
-- 2. ADD customer_id to subscriptions (nullable first)
-- =========================================
ALTER TABLE "subscriptions"
    ADD COLUMN "customer_id" INTEGER;

-- =========================================
-- 3. FK constraint
-- =========================================
ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_customer_id_fkey"
        FOREIGN KEY ("customer_id")
            REFERENCES "customers"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

-- =========================================
-- 4. INDEX for FK
-- =========================================
CREATE INDEX "subscriptions_customer_id_idx"
    ON "subscriptions" ("customer_id");

-- =========================================
-- 5. DROP old column (ONLY AFTER BACKFILL)
-- =========================================
ALTER TABLE "subscriptions"
DROP COLUMN "user_id";