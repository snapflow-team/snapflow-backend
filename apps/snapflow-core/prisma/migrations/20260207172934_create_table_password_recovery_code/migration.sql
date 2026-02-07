-- CreateTable
CREATE TABLE "password_recovery_codes" (
    "id" SERIAL NOT NULL,
    "recovery_code" VARCHAR(255),
    "expiration_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "password_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_codes_recovery_code_key" ON "password_recovery_codes"("recovery_code");

-- CreateIndex
CREATE UNIQUE INDEX "password_recovery_codes_userId_key" ON "password_recovery_codes"("userId");

-- AddForeignKey
ALTER TABLE "password_recovery_codes" ADD CONSTRAINT "password_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
