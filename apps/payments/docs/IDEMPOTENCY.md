# Идемпотентность в `payments` сервисе

Этот документ описывает, как в сервисе `apps/payments` реализована защита от повторной обработки событий и повторных внешних вызовов.

## Кратко: какие есть уровни защиты

В сервисе используется несколько слоев идемпотентности:

1. **Дедупликация входящих Stripe webhook событий** по `event.id` через таблицу `inbox_events`.
2. **Асинхронная обработка через Inbox Processor** со статусами, ретраями и восстановлением "зависших" задач.
3. **Защита от устаревших событий Stripe** через `lastStripeEventAt` в локальной подписке.
4. **Идемпотентные внешние команды в Stripe** через `outbox_commands` и передачу `idempotencyKey` в Stripe API.

Вместе это дает устойчивость к:
- повторной доставке одного и того же webhook от Stripe;
- падениям между шагами обработки;
- повторной отправке команд во внешний провайдер;
- частичному выполнению при временных ошибках.

## 1) Вход webhook: дедуп по `event.id` (Inbox Pattern)

### Где реализовано
- `StripeWebhookController` принимает webhook и передает в `ReceiveStripeWebhookUseCase`.
- `ReceiveStripeWebhookUseCase` валидирует подпись (`StripeService.constructEvent`) и делает `inboxRepository.tryInsertEvent(event)`.
- Таблица `inbox_events` использует `event_id` как `PRIMARY KEY`.

### Как работает идемпотентность
- Первый webhook с конкретным `event.id` успешно вставляется как `PENDING`.
- Повтор того же webhook приводит к `P2002` (уникальный конфликт), который перехватывается и трактуется как "уже получили" (`inserted = false`).
- HTTP-обработчик при этом возвращает `204 No Content`, то есть дубликаты не вызывают ошибку API.

Итог: **одно и то же Stripe событие физически сохраняется только один раз**.

## 2) Inbox Processor: безопасная обработка и повторы

### Где реализовано
- `InboxProcessorService` (cron каждые 10 секунд).
- `InboxRepository.lockEventsForProcessing()`:
  - выбирает только `PENDING`;
  - атомарно переводит их в `PROCESSING`;
  - использует `FOR UPDATE SKIP LOCKED`.
- `InboxRepository.markAsProcessed()` / `markAsFailed()`.
- Константы: `LOCK_BATCH_SIZE=50`, `MAX_ATTEMPTS=10`, `STALE_THRESHOLD_MINUTES=5`.

### Как это защищает от дублей и гонок
- Параллельные воркеры не "забирают" одно и то же событие одновременно (`SKIP LOCKED`).
- Если обработка упала, событие возвращается в `PENDING` (пока не превышен лимит попыток).
- Если воркер умер в статусе `PROCESSING`, отдельный cron возвращает такие записи в `PENDING` после порога "зависания".

Итог: **обработка близка к модели at-least-once**, поэтому бизнес-обработчики должны быть повторяемыми.

## 3) Защита от старых Stripe событий

### Где реализовано
- В `subscriptions` обработчиках используется helper `checkIsOldEvent(event, localSub)`.
- Проверка сравнивает `event.created` с `subscription.lastStripeEventAt`.
- `lastStripeEventAt` обновляется при успешных переходах состояния подписки.

### Зачем это нужно
Stripe события могут приходить не строго по порядку или с задержкой. Если применить более старое событие после нового, можно откатить состояние назад.

Проверка "старое ли событие" позволяет пропустить устаревший webhook и не портить актуальное состояние.

## 4) Идемпотентность исходящих команд в Stripe (Outbox Command)

### Где реализовано
- При продлении подписки (`checkout.session.completed` в режиме `payment`) в одной транзакции:
  - обновляется локальная БД;
  - пишется доменное событие в `outbox_events`;
  - создается команда `STRIPE_EXTEND_SUBSCRIPTION` в `outbox_commands`.
- `OutboxCommandProcessorService` периодически забирает `PENDING` команды.
- `StripeExtendSubscriptionExecutor` вызывает `stripeService.extendSubscription(...)` и передает `idempotencyKey = command.id`.

### Что это дает
- Если команда переисполнится (ретрай, временный сбой, повторный запуск воркера), в Stripe уйдет **тот же idempotency key**.
- Stripe не выполнит дублирующий эффект повторно, а вернет консистентный результат для того же ключа.

Итог: **повторная доставка/исполнение outbox-команды не приводит к повторному изменению подписки у Stripe**.

## Жизненный цикл Stripe webhook (упрощенно)

1. Stripe отправляет webhook.
2. Контроллер валидирует подпись и сохраняет событие в `inbox_events` (дедуп по `event.id`).
3. Фоновый inbox-процессор берет `PENDING` события и вызывает нужный handler.
4. Handler в транзакции обновляет состояние домена и пишет outbox-события/команды.
5. Inbox событие помечается `PROCESSED` (или уходит на ретрай).
6. Outbox command processor отправляет внешнюю команду в Stripe с `idempotencyKey`.

## Гарантии и ограничения

### Что гарантируется сейчас
- **Дедупликация по входящему Stripe `event.id`**.
- **Безопасный конкурентный захват задач** через `FOR UPDATE SKIP LOCKED`.
- **Ретраи и восстановление после падений** для inbox/outbox команд.
- **Идемпотентный внешний вызов Stripe** для `STRIPE_EXTEND_SUBSCRIPTION`.
- **Защита от устаревших событий** для ключевых subscription webhook handler-ов.

### На что обратить внимание
- Модель обработки webhook: **at-least-once**, а не exactly-once.
- Не все handler-ы в одинаковой степени "мягко" скипают старые/невалидные события; часть сценариев может уходить в retry и логировать ошибку.
- Идемпотентный ключ в Stripe сейчас явно используется в сценарии продления подписки через outbox command.

## Полезные точки в коде

- Вход webhook: `src/modules/subscriptions/api/stripe-webhook.controller.ts`
- Команда приема webhook: `src/modules/subscriptions/application/usecases/receive-stripe-webhook.usecase.ts`
- Inbox repository/processor: `src/modules/inbox/repositories/inbox.repository.ts`, `src/modules/inbox/services/inbox-processor.service.ts`
- Проверка старых событий: `src/modules/subscriptions/application/webhook/handlers/utils/check-is-old-event.helper.ts`
- Outbox command processor: `src/modules/outbox-commands/services/outbox-command-processor.service.ts`
- Исполнитель Stripe-команды: `src/modules/outbox-commands/executors/stripe-extend-subscription.executor.ts`
- Вызов Stripe с `idempotencyKey`: `src/modules/subscriptions/application/services/stripe.service.ts`
- Prisma схема: `prisma/schema.prisma`

