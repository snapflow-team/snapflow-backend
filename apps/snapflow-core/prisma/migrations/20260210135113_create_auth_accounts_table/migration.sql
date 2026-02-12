-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- CreateTable
CREATE TABLE "AuthAccount" (
    "user_id" INTEGER NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "crated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_id_provider_key" ON "AuthAccount"("provider_id", "provider");

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
