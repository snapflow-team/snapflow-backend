-- =========================================
-- Partial UNIQUE индексы (Soft Delete)
-- Уникальность пар обеспечивается только среди активных записей (deleted_at IS NULL).
-- После soft-delete можно создать новую активную запись с той же парой ключей.
-- =========================================

CREATE UNIQUE INDEX "user_follows_follower_following_unique_active"
    ON "user_follows" ("follower_id", "following_id")
    WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "post_likes_post_user_unique_active"
    ON "post_likes" ("post_id", "user_id")
    WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "comment_likes_comment_user_unique_active"
    ON "comment_likes" ("comment_id", "user_id")
    WHERE "deleted_at" IS NULL;

-- =========================================
-- Индексы для recentLikers (активные лайки, сортировка по дате)
-- =========================================

CREATE INDEX "post_likes_post_id_created_at_active_idx"
    ON "post_likes" ("post_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

CREATE INDEX "comment_likes_comment_id_created_at_active_idx"
    ON "comment_likes" ("comment_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

-- =========================================
-- Индексы для списков подписок (активные фолловы, сортировка по дате)
-- follower_id — кого я читаю; following_id — кто читает меня
-- =========================================

CREATE INDEX "user_follows_follower_id_created_at_active_idx"
    ON "user_follows" ("follower_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;

CREATE INDEX "user_follows_following_id_created_at_active_idx"
    ON "user_follows" ("following_id", "created_at" DESC)
    WHERE "deleted_at" IS NULL;
