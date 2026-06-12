-- AlterTable
ALTER TABLE "admin_sessions" DROP COLUMN IF EXISTS "user_agent";

ALTER TABLE "admin_sessions" ADD COLUMN "device_name" VARCHAR(255) NOT NULL DEFAULT 'Unknown';
ALTER TABLE "admin_sessions" ADD COLUMN "browser_name" VARCHAR(255);
ALTER TABLE "admin_sessions" ADD COLUMN "browser_version" VARCHAR(255);
ALTER TABLE "admin_sessions" ADD COLUMN "os_name" VARCHAR(255);
ALTER TABLE "admin_sessions" ADD COLUMN "os_version" VARCHAR(255);
ALTER TABLE "admin_sessions" ADD COLUMN "device_type" VARCHAR(255);

ALTER TABLE "admin_sessions" ALTER COLUMN "ip" SET NOT NULL;
ALTER TABLE "admin_sessions" ALTER COLUMN "ip" SET DEFAULT '';

ALTER TABLE "admin_sessions" ALTER COLUMN "device_name" DROP DEFAULT;
ALTER TABLE "admin_sessions" ALTER COLUMN "ip" DROP DEFAULT;
