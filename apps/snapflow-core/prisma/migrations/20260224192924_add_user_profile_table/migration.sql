-- CreateTable
CREATE TABLE "user_profiles" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "first_name" VARCHAR(50),
    "last_name" VARCHAR(50),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "date_of_birth" TIMESTAMP(3),
    "about_me" VARCHAR(200),
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_user_id_deleted_at_idx" ON "user_profiles"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
