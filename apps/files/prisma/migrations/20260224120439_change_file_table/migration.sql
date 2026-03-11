/*
  Warnings:

  - Changed the type of `user_id` on the `files` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED');

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;
