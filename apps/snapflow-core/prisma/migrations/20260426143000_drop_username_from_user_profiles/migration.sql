-- Remove duplicated username from user_profiles.
DROP INDEX IF EXISTS public.user_profiles_username_unique_active;

ALTER TABLE public.user_profiles
    DROP COLUMN IF EXISTS username;
