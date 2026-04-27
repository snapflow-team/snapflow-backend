-- up
WITH duplicate_drafts AS (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY user_id
                ORDER BY created_at DESC, id DESC
            ) AS rn
        FROM "posts"
        WHERE "status" = 'DRAFT' AND "deleted_at" IS NULL
    ) ranked
    WHERE ranked.rn > 1
),
soft_deleted_posts AS (
    UPDATE "posts" p
    SET
        "deleted_at" = NOW(),
        "updated_at" = NOW()
    FROM duplicate_drafts d
    WHERE p.id = d.id
    RETURNING p.id
)
UPDATE "post_medias" pm
SET
    "deleted_at" = NOW(),
    "updated_at" = NOW()
FROM soft_deleted_posts s
WHERE pm."post_id" = s.id AND pm."deleted_at" IS NULL;

CREATE UNIQUE INDEX idx_posts_user_draft_active
    ON "posts" ("user_id")
    WHERE "status" = 'DRAFT' AND "deleted_at" IS NULL;
