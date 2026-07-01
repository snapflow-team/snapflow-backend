BEGIN;

ALTER TABLE "notifications"
    ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "notifications"
    ALTER COLUMN "is_read" DROP DEFAULT;

DROP INDEX "notifications_user_id_created_at_idx";

CREATE INDEX "notifications_user_id_created_at_is_read_idx"
    ON "notifications" ("user_id", "created_at", "is_read");

COMMIT;