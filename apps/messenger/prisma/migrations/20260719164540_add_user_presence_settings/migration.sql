-- CreateTable
CREATE TABLE "user_presence_settings" (
    "user_id" INTEGER NOT NULL,
    "show_activity_status" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_presence_settings_pkey" PRIMARY KEY ("user_id")
);
