-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('DELETE_S3_FILE');

-- AlterTable
ALTER TABLE "outbox_events"
ALTER COLUMN "type" TYPE "OutboxEventType"
    USING "type"::text::"OutboxEventType";
