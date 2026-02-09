/*
  Warnings:

  - You are about to drop the column `userId` on the `email_confirmation_codes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `password_recovery_codes` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `sessions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `email_confirmation_codes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id]` on the table `password_recovery_codes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `email_confirmation_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `password_recovery_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `device_id` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "email_confirmation_codes" DROP CONSTRAINT "email_confirmation_codes_userId_fkey";

-- DropForeignKey
ALTER TABLE "password_recovery_codes" DROP CONSTRAINT "password_recovery_codes_userId_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropIndex
DROP INDEX "email_confirmation_codes_userId_key";

-- DropIndex
DROP INDEX "password_recovery_codes_userId_key";

-- AlterTable
ALTER TABLE "email_confirmation_codes" DROP COLUMN "userId",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "password_recovery_codes" DROP COLUMN "userId",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "deviceId",
DROP COLUMN "userId",
ADD COLUMN     "device_id" TEXT NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "email_confirmation_codes_user_id_key" ON "email_confirmation_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_codes_user_id_key" ON "password_recovery_codes"("user_id");

-- AddForeignKey
ALTER TABLE "email_confirmation_codes" ADD CONSTRAINT "email_confirmation_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_recovery_codes" ADD CONSTRAINT "password_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
