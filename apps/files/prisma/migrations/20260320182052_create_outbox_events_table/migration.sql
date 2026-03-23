-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_events"
(
    "id"         UUID                NOT NULL DEFAULT gen_random_uuid(),
    "type"       VARCHAR(255)        NOT NULL,
    "payload"    JSONB               NOT NULL,
    "status"     "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "error"      TEXT,
    "created_at" TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)        NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events" ("status", "created_at");
