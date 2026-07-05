# Глубокое ревью кода (без messenger)

## Область ревью
- Проверено: `apps/snapflow-core`, `apps/files`, `apps/payments`, `libs/*`.
- Явно исключено: `apps/messenger`.
- Не проверялись сгенерированные/сборочные артефакты: `dist`, `generated`, `node_modules`.
- Метод: статический анализ (`eslint`) + ручной аудит критичных потоков (webhook, транзакции, outbox/inbox, auth, exception filters, RPC-контракты).

## Краткий итог
- Текущее состояние: проект рабочий, но с высоким операционным риском в биллинге, консистентности обработки ошибок и типобезопасности.
- Самый критичный риск находится в жизненном цикле подписок в payments: логика истечения/продления может приводить к неверным переходам состояний и побочным эффектам внутри границ DB-транзакций.
- Общий слой `libs/exceptions` хрупкий: глобальные фильтры могут возвращать вводящие в заблуждение body/code ошибок при отклонении app-конфигурации.
- Тестовое покрытие широкое в `snapflow-core`, но слабее в `files` и выборочное по edge/failure сценариям в `payments`.
- Сигнал от ESLint высокий: `183 errors`, `8 warnings` (вне `messenger`), что говорит о заметном техническом долге в поддерживаемости.

## Количественные метрики
- Всего проблем ESLint (в рамках указанного scope): `191` (`183` errors, `8` warnings).
- По зонам:
  - `apps/snapflow-core`: `135` errors, `1` warning (50 файлов с проблемами)
  - `apps/payments`: `20` errors, `4` warnings (11 файлов с проблемами)
  - `apps/files`: `11` errors, `0` warnings (6 файлов с проблемами)
  - `libs`: `17` errors, `3` warnings (7 файлов с проблемами)

## Критичные проблемы (Critical)

### 1) Истекший checkout может отменить активную подписку
- Файл: `apps/payments/src/modules/subscriptions/application/webhook/handlers/checkout-session-expired-handler.ts`
- Проблема: обработчик всегда вызывает отмену подписки после истечения checkout session.
- Влияние: если истекшая сессия относится к продлению уже ACTIVE-подписки, пользователя можно ошибочно понизить.
- Почему это critical: прямой риск потери платного доступа и повреждения биллингового состояния.

### 2) Внешние побочные эффекты выполняются внутри DB-транзакции
- Файлы:
  - `apps/payments/src/modules/inbox/services/inbox-processor.service.ts`
  - `apps/payments/src/modules/subscriptions/application/webhook/handlers/checkout-session-completed-handler.ts`
- Проблема: webhook-обработчик запускается под `prisma.$transaction`, но внутри делает Stripe-вызовы и queue-операции.
- Влияние: долгие сетевые вызовы удерживают транзакции; публикация в очередь может произойти до устойчивого commit, вызывая рассинхрон/ретраи.
- Почему это critical: риск нарушения транзакционной целостности и деградации под нагрузкой.

### 3) В Files RPC нет аутентификации на транспортном уровне
- Файлы:
  - `apps/files/src/main.ts`
  - `apps/files/src/modules/media-files/api/media.controller.ts`
- Проблема: TCP-микросервис принимает RPC-команды без service-level auth/mTLS/проверки секрета; доверяет payload (например, `userId`).
- Влияние: если порт доступен из недоверенного сегмента сети, это прямой риск неавторизованных файловых операций.
- Почему это critical: граница безопасности зависит только от изоляции инфраструктуры, а не от гарантий приложения.

### 4) `invoice.payment_failed` частично обновляет состояние вне транзакции
- Файл: `apps/payments/src/modules/subscriptions/application/webhook/handlers/invoice-payment-failed-handler.ts`
- Проблема: вызов `setToPastDue(...)` не получает `tx`, тогда как сохранение outbox-event идет в `tx`.
- Влияние: возможны частичные коммиты состояния (подписка обновилась, а событие потеряно, или наоборот — в зависимости от момента сбоя).
- Почему это critical: риск межсервисного рассинхрона и поломки eventual consistency.

## Высокие проблемы (High)

### 5) Admin login сравнивает пароль в открытом виде
- Файл: `apps/snapflow-core/src/modules/admin/application/usecases/admin-login.usecase.ts`
- Проблема: прямое сравнение с env-паролем (`password !== adminSettings.password`).
- Влияние: слабая защита секрета; нет timing-safe compare; нет модели индивидуальных админ-учеток.

### 6) Создание checkout session не компенсируется при падении DB
- Файл: `apps/payments/src/modules/subscriptions/application/usecases/create-checkout-session.usecase.ts`
- Проблема: сначала создается Stripe checkout session, запись в БД выполняется потом; при падении БД остаются orphan-сессии в Stripe.
- Влияние: биллинговый мусор + нагрузка на поддержку + рассинхрон local state vs Stripe.

### 7) Не обеспечена уникальность Customer на пользователя
- Файл: `apps/payments/prisma/schema.prisma`
- Проблема: `Customer.userId` индексируется, но не уникален.
- Влияние: возможны несколько customer-записей на одного пользователя; неоднозначная семантика поиска в потоке подписок.

### 8) Несогласованная политика понижения статуса между сервисами при renewal failure
- Файл: `apps/snapflow-core/src/modules/integrations/payments/payments-user-sync.service.ts`
- Проблема: при событии renewal failure аккаунт сразу понижается до PERSONAL, в то время как в payments подписка может оставаться в `PAST_DUE`.
- Влияние: неконсистентное поведение продукта и преждевременная потеря функциональности.

### 9) Ошибки отправки email проглатываются
- Файлы:
  - `apps/snapflow-core/src/modules/notifications/emails/event-handlers/send-confirmation-email-when-user-registered.event-handler.ts`
  - `apps/snapflow-core/src/modules/notifications/emails/event-handlers/send-password-recovery-email.event-handler.ts`
- Проблема: в `catch` только `console.error`, без retry-стратегии и dead-letter механизма.
- Влияние: тихие пользовательские сбои в критичных потоках onboarding/recovery.

## Проблемы среднего приоритета (Medium)

### 10) Presigned upload игнорирует заявленный размер файла
- Файл: `apps/files/src/modules/media-files/infrastructure/storage/storage.service.ts`
- Проблема: параметр `size` принимается, но не используется в `PutObjectCommand`.
- Влияние: слабая server-side валидация ожидаемого размера загружаемого файла.

### 11) Cleanup pending-файлов авто-подтверждает загрузки по факту наличия объекта в S3
- Файлы:
  - `apps/files/src/modules/media-files/application/services/pending-files-cleanup.service.ts`
  - `apps/files/src/modules/media-files/infrastructure/repositories/files.repository.ts`
- Проблема: устаревшие pending-файлы переводятся в uploaded, если объект есть в S3, без явного user-confirm.
- Влияние: обход бизнес-флоу в edge-сценариях; неожиданные переходы состояния.

### 12) Схема outbox publish-then-mark может давать дубликаты
- Файл: `apps/payments/src/modules/outbox/services/outbox-processor.service.ts`
- Проблема: сначала publish в брокер, потом mark-as-processed.
- Влияние: при сбое после publish событие может быть обработано повторно.

### 13) Бесконечные ретраи для poisoned messages
- Файл: `apps/snapflow-core/src/modules/integrations/payments/payments-events.consumer.ts`
- Проблема: при ошибке обработчика используется `nack(..., requeue=true)` безусловно.
- Влияние: проблемные сообщения могут зациклиться без DLQ-стратегии.

### 14) Global HTTP exception filter отдает server-error body для `HttpException`
- Файл: `libs/exceptions/http/filters/global-http-exceptions.filter.ts`
- Проблема: статус может быть 4xx из Nest `HttpException`, но body всегда генерируется server-error factory.
- Влияние: несогласованный API-контракт (`status` не совпадает с бизнес `code`), сложная обработка на клиенте.

### 15) Неизвестные domain-коды мапятся в HTTP 418
- Файл: `libs/exceptions/core/utils/domain-exceptions-code.mapper.ts`
- Проблема: в ветке по умолчанию возвращается `I_AM_A_TEAPOT`.
- Влияние: нестандартный статус может утекать в API при неучтенных domain-кодах.

### 16) В cursor-пагинации нет верхней границы лимита
- Файл: `libs/dto/cursor-query.params.dto.ts`
- Проблема: есть `@Min(1)`, но нет `@Max(...)`.
- Влияние: неограниченный `limit` может перегружать БД/память при злоупотреблении запросами.

## Отмеченный техдолг и smells поддержки
- Большой объем небезопасной типизации (`any`, `no-unsafe-*`), особенно в тестах и фильтрах.
- Много style/prettier нарушений — слабая дисциплина quality gates в CI.
- Межприложенческие импорты и несогласованное именование/опечатки в контрактах снижают модульную изоляцию.
- `console.log`/`console.error` в runtime-путях вместо унифицированного structured logger.
- Длинные методы webhook-обработчиков в payments со смешанной ответственностью (валидация + оркестрация + побочные эффекты).

## Рекомендации по рефакторингу (по приоритету)

### P0 (срочно)
1. Исправить логику checkout-expired:
   - Разделить сценарии initial subscription checkout и extension checkout.
   - Для истечения при extension: только fail платежа, без cancel активной подписки.
2. Вынести внешние побочные эффекты из DB-транзакций:
   - В транзакции оставить только DB-state + outbox.
   - Queue/Stripe сайд-эффекты выполнять в выделенных processor-этапах.
3. Выравнять транзакционные границы для `invoice.payment_failed`:
   - Все связанные записи (`setToPastDue`, сохранение outbox, обновление метаданных) выполнять в одном транзакционном контексте.

### P1 (краткосрочно)
1. Усилить границу безопасности Files RPC:
   - Добавить service auth (shared secret/mTLS/network policy enforcement).
   - Явно валидировать доверенность источника, а не только форму payload.
2. Переработать создание checkout session:
   - Добавить компенсации на сбои создания объектов в Stripe.
   - Использовать idempotency keys и reconciliation orphan-сессий.
3. Зафиксировать инварианты уникальности в модели payments:
   - Обеспечить один активный customer identity на пользователя (или явно описать корректную multi-customer стратегию).
4. Стандартизировать state machine подписок между сервисами:
   - Задать единую truth-модель переходов `ACTIVE`/`PAST_DUE`/`CANCELLED`/account type.

### P2 (качество/стабильность)
1. Пересобрать контракт exception-layer в `libs`:
   - `GlobalExceptionsFilter` должен сохранять семантический body для framework errors.
   - Заменить fallback `418` на безопасный `500` для неизвестных domain-кодов.
2. Ужесточить typed-границы:
   - Убрать `any` из filters, integrations и test-managers.
   - Добавить typed response guards для RPC payload там, где нужно.
3. Ввести ограниченные значения pagination defaults и max limits.
4. Заменить прямые `console.*` на проектный logger во всех runtime-путях.

### P3 (стратегия тестирования)
1. Добавить регрессионные тесты на edge-сценарии payments:
   - истечение extension checkout при активной подписке
   - частичный сбой между БД и внешними системами
   - устойчивость к дубликатам в outbox delivery
2. Добавить security/contract тесты для Files RPC transport.
3. Добавить тесты exception filters в `libs` (http/rpc) на консистентность mapping/body.

## Предложенный план на 2 недели
- Неделя 1:
  - P0-фиксы в payments + горячие регрессионные тесты.
  - Временные observability-дашборды по webhook/outbox/inbox ошибкам.
- Неделя 2:
  - P1-усиление auth для files transport.
  - Рефактор exception-layer в libs + лимиты пагинации + чистка приоритетных unsafe typing нарушений.

## Финальная оценка
- Базовая архитектура хорошая (используются CQRS/outbox/inbox-паттерны), но надежность зависит от ужесточения транзакционных границ и консистентности state machine.
- Основная концентрация рисков: `payments` и общий exception handling в `libs`.
- Перед добавлением крупных новых фич приоритетно закрыть P0/P1, чтобы не наращивать критичные прод-риски.

