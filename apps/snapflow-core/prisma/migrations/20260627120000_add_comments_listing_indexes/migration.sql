-- =========================================
-- Индексы для листинга корневых комментариев поста (UC-4)
-- Фильтр: post_id + parent_id IS NULL + deleted_at IS NULL
-- Сортировка: own-first (user_id) в query/SQL, затем created_at DESC, id DESC (keyset)
-- =========================================

CREATE INDEX "comments_post_id_root_created_at_active_idx"
    ON "comments" ("post_id", "created_at" DESC, "id" DESC)
    WHERE "deleted_at" IS NULL AND "parent_id" IS NULL;

-- =========================================
-- Индекс для repliesCount (активные ответы на комментарий)
-- =========================================

CREATE INDEX "comments_parent_id_active_idx"
    ON "comments" ("parent_id")
    WHERE "deleted_at" IS NULL AND "parent_id" IS NOT NULL;
