-- This is an empty migration.
-- 🔻 Удаляем старые уникальные ограничения (они ломают soft delete)

DROP INDEX IF EXISTS "user_profiles_username_key";
DROP INDEX IF EXISTS "user_profiles_user_id_key";


-- 🔻 Username уникален только среди НЕ удалённых профилей
CREATE UNIQUE INDEX "user_profiles_username_active_key"
    ON "user_profiles" ("username")
    WHERE "deleted_at" IS NULL;


-- 🔻 У пользователя может быть только один АКТИВНЫЙ профиль
CREATE UNIQUE INDEX "user_profiles_user_id_active_key"
    ON "user_profiles" ("user_id")
    WHERE "deleted_at" IS NULL;


-- 🔻 Оставляем обычный индекс для быстрых выборок
CREATE INDEX IF NOT EXISTS "user_profiles_user_id_deleted_at_idx"
    ON "user_profiles" ("user_id", "deleted_at");