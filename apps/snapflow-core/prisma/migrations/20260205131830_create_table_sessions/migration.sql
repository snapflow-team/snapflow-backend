-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "ip" VARCHAR(255) NOT NULL,
    "iat" TIMESTAMP(3) NOT NULL,
    "exp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_deviceId_key" ON "sessions"("deviceId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
