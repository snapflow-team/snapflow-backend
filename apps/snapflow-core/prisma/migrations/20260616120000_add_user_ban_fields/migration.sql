-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
    ADD COLUMN "ban_reason" VARCHAR(500);

ALTER TABLE "users"
    ADD COLUMN "banned_at" TIMESTAMP(3);
