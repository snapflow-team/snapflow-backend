# Сессия: RabbitMQ + Notifications — заметки и прогресс

> Дополнение к [notifications-rabbitmq-review.md](./notifications-rabbitmq-review.md)  
> Дата сессии: 2026‑06‑06  
> Контекст: промежуточная реализация модуля нотификаций (активация подписки → RabbitMQ → WebSocket)

---

## Содержание

1. [Исходная задача](#1-исходная-задача)
2. [Архитектура потока](#2-архитектура-потока)
3. [Что сделано в этой сессии](#3-что-сделано-в-этой-сессии)
4. [Диагностика и баги по ходу работы](#4-диагностика-и-баги-по-ходу-работы)
5. [Текущее состояние (после сессии)](#5-текущее-состояние-после-сессии)
6. [Логи: что искать](#6-логи-что-искать)
7. [Следующие шаги](#7-следующие-шаги)

---

## 1. Исходная задача

Проанализировать всё, что связано с RabbitMQ в `payments` и `snapflow-core`, с фокусом на модуле `notifications`:

- публикация события об активации подписки;
- обработка этого события в core;
- отправка нотификации пользователю.

Модуль **ещё не доведён до конца** — это промежуточный вариант.

**Результат анализа:** файл [notifications-rabbitmq-review.md](./notifications-rabbitmq-review.md) с чек‑листом, ревью, критичными багами (C1–C4) и рекомендациями.

---

## 2. Архитектура потока

```
Stripe webhook (checkout.session.completed)
        │
        ▼
CheckoutSessionCompletedHandler (payments, внутри DB-транзакции)
        │
        ├── outbox: SUBSCRIPTION_ACTIVATED
        │       └── OutboxProcessor (cron) → RabbitMQ "SUBSCRIPTION_ACTIVATED"
        │               └── core: PaymentsEventsConsumer → PaymentsUserSyncService
        │
        └── BullMQ: addSubscriptionActivatedJob()
                └── SubscriptionProcessor.handleActivatedJob()
                        └── RabbitMQ "SUBSCRIPTION_ACTIVATED_NOTIFICATION"
                                └── core: NotificationEventsConsumer
                                        └── WebsocketNotificationService → WebsocketService → WS
```

**Exchange:** `payments_exchange` (topic, durable)

**Routing keys:**

| Тип | Ключ | Consumer в core |
|-----|------|-----------------|
| Домен | `SUBSCRIPTION_ACTIVATED` | `PaymentsEventsConsumer` |
| Нотификация | `SUBSCRIPTION_ACTIVATED_NOTIFICATION` | `NotificationEventsConsumer` |

**Очереди (env):**

| Переменная | Назначение |
|------------|------------|
| `PAYMENTS_EVENTS_QUEUE_NAME` | Доменные события (напр. `snapflow.payments.events`) |
| `NOTIFICATIONS_EVENTS_QUEUE_NAME` | Нотификации (напр. `snapflow.notifications.events`) |

**Ключевые файлы:**

| Сервис | Файл |
|--------|------|
| payments — публикация | `apps/payments/src/modules/outbox/services/rabbitmq-publisher.service.ts` |
| payments — BullMQ job | `apps/payments/src/modules/queue/processors/subscription.processor.ts` |
| core — consumer нотификаций | `apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts` |
| core — обработка | `apps/snapflow-core/src/modules/notifications/websocket/services/websocket-notification.service.ts` |
| core — WS отправка | `apps/snapflow-core/src/modules/notifications/websocket/services/websocket.service.ts` |
| core — WS gateway | `apps/snapflow-core/src/modules/notifications/websocket/notification-websocket.gateway.ts` |
| контракты | `libs/contracts/payments/payments-exchange.constants.ts` |

---

## 3. Что сделано в этой сессии

### 3.1. Ревью (начало сессии)

Создан [notifications-rabbitmq-review.md](./notifications-rabbitmq-review.md):

- схема потока;
- 4 критичных бага (C1–C4);
- баги высокого/среднего/низкого приоритета;
- чек‑лист готовности;
- рекомендуемый порядок исправлений.

### 3.2. Фикс C1 — разделение очередей

**Проблема:** `NotificationEventsConsumer` и `PaymentsEventsConsumer` оба слушали `paymentsEventsQueueName`. RabbitMQ раздавал сообщения round‑robin → ~50% событий терялись.

**Исправление:** в `NotificationEventsConsumer` заменено на `notificationsEventsQueueName` (assert, bind, consume).

**Файл:** `apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts`

### 3.3. Логи в core (только core)

Расставлены логи через `ContextLogger`:

| Файл | Что логируется |
|------|----------------|
| `NotificationEventsConsumer` | старт (`Listening on queue "..."`), получение события, успешная обработка, warn на неизвестный routing key |
| `WebsocketNotificationService` | `Handling notification: routingKey=..., userId=...` |
| `WebsocketService` | `Notification sent via WebSocket to user:..., type=...` |

Отладочные `console.log` / `console.error` в consumer заменены на `ContextLogger`.

### 3.4. Фикс падения BullMQ job (createdAt)

**Проблема:** после создания тестовой джобы через `GET /plans` логи были только в payments, в core — тишина.

**Причина:** BullMQ сериализует `data` в JSON → `createdAt` приходит **строкой**, не `Date`. Вызов `job.data.createdAt.toISOString()` падал с `TypeError` **до** `publish()`.

**Исправление:** нормализация `createdAt` в `SubscriptionProcessor.handleActivatedJob`:

```typescript
const createdAt: string =
  job.data.createdAt instanceof Date
    ? job.data.createdAt.toISOString()
    : job.data.createdAt;
```

**Файл:** `apps/payments/src/modules/queue/processors/subscription.processor.ts`

---

## 4. Диагностика и баги по ходу работы

### 4.1. «Логи только в payments» (до фикса createdAt)

**Симптомы:**

```
Job created in queue service
Job process
Job processed in queue processor
```

В core — только стартовые логи consumer'ов, без `Notification event received`.

**Диагностика:** `console.log('Job processed in queue processor')` выполнялся, но `publish()` — нет. BullMQ job падала молча (`attempts: 0`, нет try/catch в processor).

### 4.2. Логи после фикса createdAt (2026‑06‑06 ~16:32)

**Симптомы в core:**

```json
{ "message": "Unhandled routing key: SUBSCRIPTION_ACTIVATED_NOTIFICATION", "sourceName": "PaymentsEventsConsumer" }
{ "message": "Notification event received: routingKey=SUBSCRIPTION_ACTIVATED_NOTIFICATION, queue=snapflow.notifications.events, payload={\"payload\":{\"userId\":1,\"createdAt\":\"...\"}}" }
{ "message": "Handling notification: routingKey=SUBSCRIPTION_ACTIVATED_NOTIFICATION, userId=undefined" }
{ "message": "Notification sent via WebSocket to user:undefined, type=SUBSCRIPTION_EXPIRES_7D" }
{ "message": "Notification event processed: routingKey=SUBSCRIPTION_ACTIVATED_NOTIFICATION" }
```

**Интерпретация:**

| Наблюдение | Статус | Объяснение |
|------------|--------|------------|
| `Notification event received` | ✅ | RabbitMQ → core работает |
| `Notification event processed` | ✅ | Consumer ack-нул сообщение |
| `userId=undefined` | ❌ C2 | Двойная обёртка payload (см. ниже) |
| `user:undefined` в WS | ❌ | Следствие C2 |
| Warn в PaymentsEventsConsumer | ⚠️ | Stale binding в RabbitMQ (см. ниже) |
| `type=SUBSCRIPTION_EXPIRES_7D` | ❌ H1 | Неверный текст для активации |

### 4.3. C2 — двойная обёртка payload (ещё не исправлено)

**Publisher (payments):**

```typescript
await this.rabbitPublisher.publish(..., {
  payload: { userId, createdAt },  // ← лишняя обёртка
});
```

**Consumer (core):** читает `payload.userId` с верхнего уровня → `undefined`.

**Реальная структура:** `{ "payload": { "userId": 1, "createdAt": "..." } }`

**Фикс:** публиковать `{ userId, createdAt }` напрямую **или** в consumer передавать `payload.payload`.

### 4.4. Warn в PaymentsEventsConsumer — stale binding

`PaymentsEventsConsumer` биндит только `ALL_PAYMENTS_ROUTING_KEYS`, но в логах приходит `SUBSCRIPTION_ACTIVATED_NOTIFICATION`.

**Причина:** раньше `NotificationEventsConsumer` вешал notification-ключи на очередь payments. Bindings в RabbitMQ **не удаляются** при смене кода.

**Действие:** в RabbitMQ Management UI удалить notification bindings с очереди payments, либо пересоздать очередь.

### 4.5. C3 — WebSocket gateway (ещё не исправлено)

`NotificationGateway.handleConnection` захардкожен на `client.join('user:1')`, JWT закомментирован. Даже при `userId=1` клиент с другим id не получит нотификацию.

### 4.6. Тестовый триггер

В `subscriptions.controller.ts` (метод `getPlans`) добавлен вызов:

```typescript
await this.queueService.addSubscriptionActivatedJob({
  userId: 1,
  createdAt: new Date(),
});
```

Используется для ручной проверки цепочки без Stripe webhook.

---

## 5. Текущее состояние (после сессии)

| Этап | Статус |
|------|--------|
| Ревью + чек‑лист | ✅ `notifications-rabbitmq-review.md` |
| C1 — разделение очередей | ✅ Исправлено |
| Логи в core | ✅ Добавлены |
| BullMQ → publish (createdAt) | ✅ Исправлено |
| RabbitMQ → NotificationEventsConsumer | ✅ Работает |
| C2 — payload userId | ❌ Не исправлено |
| C3 — WS gateway / JWT | ❌ Не исправлено |
| C4 — DLQ / лимит requeue | ❌ Не исправлено |
| H1 — текст нотификации | ❌ Не исправлено |
| Stale bindings в RabbitMQ | ⚠️ Требует ручной очистки |

---

## 6. Логи: что искать

При успешной обработке активации в core должна быть **цепочка**:

```
NotificationEventsConsumer → Listening on queue "snapflow.notifications.events" for keys: ...
NotificationEventsConsumer → Notification event received: routingKey=SUBSCRIPTION_ACTIVATED_NOTIFICATION, ...
WebsocketNotificationService → Handling notification: routingKey=..., userId=...
WebsocketService → Notification sent via WebSocket to user:..., type=...
NotificationEventsConsumer → Notification event processed: routingKey=...
```

**Диагностика по отсутствующим логам:**

| Нет лога | Вероятная причина |
|----------|-------------------|
| `Listening on queue` | Consumer не поднялся / неверный env |
| `Notification event received` | publish не произошёл (payments) или неверный RABBITMQ_URL / binding |
| `Handling notification` | routing key не совпал с `NotificationsRoutingKey` |
| `Notification sent via WebSocket` | не дошли до WS-слоя |
| `userId=undefined` | баг C2 (двойная обёртка payload) |

---

## 7. Следующие шаги

Рекомендуемый порядок (из ревью, с учётом прогресса сессии):

1. ~~**C1** — развести очереди~~ ✅
2. **C2** — выровнять форму payload (`userId` доходит не `undefined`)
3. **C3** — JWT в gateway, `client.join('user:${userId}')`
4. Очистить stale bindings notification-ключей с очереди payments в RabbitMQ
5. **H1** — корректный `type`/`message` для активации (не «истекает через 7 дней»)
6. **C4 + DLQ** — лимит requeue вместо бесконечного nack
7. **H2** — нотификация через outbox (атомарность с транзакцией)
8. Убрать тестовый вызов `addSubscriptionActivatedJob` из `getPlans` перед prod

---

## Связанные документы

- [notifications-rabbitmq-review.md](./notifications-rabbitmq-review.md) — полное ревью с чек‑листом и описанием всех багов
