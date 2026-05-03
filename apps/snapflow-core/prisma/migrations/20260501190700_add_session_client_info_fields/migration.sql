-- AlterTable
ALTER TABLE "sessions"
ADD COLUMN "browser_name" VARCHAR(255),
ADD COLUMN "browser_version" VARCHAR(255),
ADD COLUMN "os_name" VARCHAR(255),
ADD COLUMN "os_version" VARCHAR(255),
ADD COLUMN "device_type" VARCHAR(255);
