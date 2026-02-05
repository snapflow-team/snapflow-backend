/*
Эта миграция создаёт уникальный индекс на колонку email таблицы users, учитывая только строки, у которых deleted_at IS NULL.

Цель миграции:
Обеспечить уникальность email для активных пользователей (не удалённых).
Поддерживать soft delete: удалённые пользователи (deleted_at IS NOT NULL) не будут блокировать повторное использование их email.

Детали реализации:
Индекс создаётся с использованием partial index (WHERE deleted_at IS NULL) в PostgreSQL.
Данный подход предотвращает конфликты уникальности при soft delete.
После применения индекса база данных будет автоматически проверять уникальность email только среди не удалённых записей.
*/

CREATE UNIQUE INDEX users_email_unique_not_deleted
    ON users(email)
    WHERE deleted_at IS NULL;
