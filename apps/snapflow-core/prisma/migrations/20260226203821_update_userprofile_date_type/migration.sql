-- 1. Изменяем тип колонки date_of_birth с timestamp с timezone на DATE
ALTER TABLE "user_profiles"
ALTER COLUMN "date_of_birth"
TYPE DATE
USING "date_of_birth"::DATE;