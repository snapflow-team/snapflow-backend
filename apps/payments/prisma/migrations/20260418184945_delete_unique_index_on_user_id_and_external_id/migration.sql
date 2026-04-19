-- Удаляем partial unique index для payments
DROP INDEX IF EXISTS "payments_external_id_key";