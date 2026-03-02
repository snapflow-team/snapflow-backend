-- =========================================
-- Создание таблицы user_profiles
-- =========================================

CREATE TABLE public.user_profiles
(
    id            SERIAL PRIMARY KEY,

    username      VARCHAR(30) NOT NULL,
    first_name    VARCHAR(50),
    last_name     VARCHAR(50),

    city          VARCHAR(100),
    country       VARCHAR(100),

    date_of_birth TIMESTAMP,

    about_me      VARCHAR(200),

    avatar_url    VARCHAR(500),

    created_at    TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP   NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMP,

    user_id       INTEGER     NOT NULL,

    CONSTRAINT user_profiles_user_id_fkey
        FOREIGN KEY (user_id)
            REFERENCES public.users (id)
            ON DELETE CASCADE
);

-- =========================================
-- Partial UNIQUE индекс для username
-- Гарантирует уникальность только для НЕ удалённых профилей
-- =========================================

CREATE UNIQUE INDEX user_profiles_username_unique_active
    ON public.user_profiles (username) WHERE deleted_at IS NULL;

-- =========================================
-- Индекс для быстрых выборок профиля пользователя
-- Учитывает soft delete
-- =========================================

CREATE INDEX user_profiles_user_id_deleted_at_idx
    ON public.user_profiles (user_id, deleted_at);