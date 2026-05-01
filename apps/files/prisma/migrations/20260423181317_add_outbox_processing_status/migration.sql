-- AlterEnum
ALTER TYPE "OutboxEventStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT;
