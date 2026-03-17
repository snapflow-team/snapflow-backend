/*
  Warnings:

  - Added the required column `file_id` to the `post_medias` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "post_medias" ADD COLUMN     "file_id" TEXT NOT NULL;
