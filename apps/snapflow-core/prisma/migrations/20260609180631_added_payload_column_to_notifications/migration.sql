BEGIN;

ALTER TABLE "notifications"
    ADD COLUMN "payload" JSONB;

COMMIT;
