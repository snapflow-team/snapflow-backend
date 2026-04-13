-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'BUSINESS');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'FAILED', 'PENDING');
CREATE TYPE "OutboxEventType" AS ENUM ('PAYMENT_COMPLETED', 'PAYMENT_FAILED');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "subscriptions"
(
    "id"                   SERIAL               NOT NULL,
    "user_id"              INTEGER              NOT NULL,
    "plan_id"              TEXT                 NOT NULL,
    "stripe_sub_id"        TEXT,
    "account_type"         "AccountType"        NOT NULL DEFAULT 'PERSONAL',
    "status"               "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "auto_renewal"         BOOLEAN              NOT NULL DEFAULT true,
    "current_period_start" TIMESTAMP(3),
    "current_period_end"   TIMESTAMP(3),
    "created_at"           TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3)         NOT NULL,
    "deleted_at"           TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"
(
    "id"              SERIAL            NOT NULL,
    "plan_id"         TEXT              NOT NULL,
    "external_id"     TEXT              NOT NULL,
    "provider"        "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "amount"          INTEGER           NOT NULL,
    "currency"        TEXT              NOT NULL DEFAULT 'usd',
    "status"          "PaymentStatus"   NOT NULL,
    "created_at"      TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)      NOT NULL,
    "deleted_at"      TIMESTAMP(3),
    "subscription_id" INTEGER           NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events"
(
    "id"         UUID                NOT NULL DEFAULT gen_random_uuid(),
    "type"       "OutboxEventType"   NOT NULL,
    "payload"    JSONB               NOT NULL,
    "status"     "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "error"      TEXT,
    "created_at" TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)        NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (Partial Unique for Soft Delete)
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions" ("user_id") WHERE "deleted_at" IS NULL;

-- CreateIndex (Partial Unique for Soft Delete)
CREATE UNIQUE INDEX "payments_external_id_key" ON "payments" ("external_id") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events" ("status", "created_at");

-- AddForeignKey
ALTER TABLE "payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;