BEGIN;

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'SUBSCRIPTION_ACTIVATED',
    'SUBSCRIPTION_EXPIRING_7D',
    'SUBSCRIPTION_EXPIRING_1D',
    'NEXT_PAYMENT_1D'
);

-- CreateTable
CREATE TABLE "notifications" (
                                 "id" SERIAL NOT NULL,
                                 "user_id" INTEGER NOT NULL,
                                 "message" TEXT NOT NULL,
                                 "type" "NotificationType" NOT NULL,
                                 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                 "updated_at" TIMESTAMP(3) NOT NULL,
                                 "deleted_at" TIMESTAMP(3),

                                 CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx"
    ON "notifications" ("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
        FOREIGN KEY ("user_id")
            REFERENCES "users"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;

COMMIT;