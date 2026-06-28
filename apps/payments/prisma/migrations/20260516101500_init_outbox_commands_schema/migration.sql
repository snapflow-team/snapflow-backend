-- CreateEnum
CREATE TYPE "OutboxCommandType" AS ENUM ('STRIPE_EXTEND_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "OutboxCommandStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "outbox_commands" (
    "id" UUID NOT NULL,
    "type" "OutboxCommandType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxCommandStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_commands_status_created_at_idx" ON "outbox_commands"("status", "created_at");
