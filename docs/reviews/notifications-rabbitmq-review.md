# Ревью: RabbitMQ + модуль Notifications (payments → core)

> Статус модуля: **промежуточная реализация**. Ожидаемое поведение на этом этапе:
> при активации подписки опубликовать событие в RabbitMQ и отправить
> WebSocket‑нотификацию пользователю.
>
> Дата ревью: 2026‑06‑06

---

## 1. Как сейчас устроен поток (как есть)

Активация подписки порождает **два независимых сообщения** в RabbitMQ:

```
Stripe webhook (checkout.session.completed, mode=subscription)
        │
        ▼
CheckoutSessionCompletedHandler.handle()  (внутри DB‑транзакции)
        ├── 1) outboxRepository.saveEvent(SUBSCRIPTION_ACTIVATED, {...})   ← доменное событие
        │        └── OutboxProcessorService (cron) → publish "SUBSCRIPTION_ACTIVATED"
        │                 └── core: PaymentsEventsConsumer → PaymentsUserSyncService (апдейт аккаунта)
        │
        └── 2) queueService.addSubscriptionActivatedJob({...})             ← нотификация
                 └── BullMQ job ACTIVATED → SubscriptionProcessor.handleActivatedJob()
                         └── publish "SUBSCRIPTION_ACTIVATED_NOTIFICATION" { payload: {...} }
                                 └── core: NotificationEventsConsumer → WebsocketNotificationService → WS
```

Exchange один на всё — `payments_exchange` (topic, durable).

Ключи маршрутизации (`libs/contracts/payments/payments-exchange.constants.ts`):
- `PaymentsRoutingKey.*` — доменные события (`SUBSCRIPTION_ACTIVATED`, …)
- `NotificationsRoutingKey.*` — события нотификаций (`SUBSCRIPTION_ACTIVATED_NOTIFICATION`, …)

В core два потребителя:
- `PaymentsEventsConsumer` — биндит `ALL_PAYMENTS_ROUTING_KEYS`
- `NotificationEventsConsumer` — биндит `ALL_NOTIFICATIONS_ROUTING_KEYS`

---

## 2. Краткий вердикт

Сценарий «активировал подписку → пользователь получил нотификацию» **сейчас работает нестабильно/случайно**. Есть как минимум 4 критичных дефекта, любой из которых ломает доставку нотификации. Главный — оба потребителя в core слушают **одну и ту же очередь**, поэтому RabbitMQ раздаёт сообщения между ними по очереди (round‑robin), и примерно половина нотификаций молча отбрасывается.

---

## 3. Критичные баги (ломают функциональность) 🔴

### [ ] C1. Оба consumer'а в core читают ОДНУ очередь → потеря ~50% сообщений
**Файл:** `apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts:37`

`NotificationEventsConsumer` берёт из конфига `paymentsEventsQueueName`, хотя для него уже заведён отдельный `notificationsEventsQueueName` (`api-settings.ts:103,151`).

```37:60:apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts
    const { rabbitMqUrl, paymentsEventsQueueName }: ApiSettings =
      this.configService.get<ApiSettings>('apiSettings');
    ...
        await channel.assertQueue(paymentsEventsQueueName, { durable: true });
        for (const key of ALL_NOTIFICATIONS_ROUTING_KEYS) {
          await channel.bindQueue(paymentsEventsQueueName, PAYMENTS_EXCHANGE, key);
        }
```

Что происходит: и `PaymentsEventsConsumer`, и `NotificationEventsConsumer` объявляют/слушают очередь с **одинаковым именем** и оба вешают на неё свои `consume()`. RabbitMQ считает это двумя конкурирующими потребителями (competing consumers) и раздаёт каждое сообщение **только одному** из них:
- `SUBSCRIPTION_ACTIVATED_NOTIFICATION` может попасть в `PaymentsEventsConsumer` → `parsePaymentsRoutingKey()` вернёт `null` → `channel.ack(msg)` → **сообщение молча выброшено**.
- `SUBSCRIPTION_ACTIVATED` может попасть в `NotificationEventsConsumer` → `parseNotificationsRoutingKey()` вернёт `null` → `ack` → **доменное событие выброшено**.

**Фикс:** использовать `notificationsEventsQueueName` в `NotificationEventsConsumer` (assert/bind/consume — все три места). Каждое логическое потребление должно иметь свою очередь.

---

### [ ] C2. Двойная обёртка payload → `userId` приходит как `undefined`
**Файлы:** `apps/payments/src/modules/queue/processors/subscription.processor.ts:34` и `.../notifications-events-consumer.ts:108`

Publisher оборачивает данные в лишний `payload`:

```34:43:apps/payments/src/modules/queue/processors/subscription.processor.ts
    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.SubscriptionActivated,
      {
        payload: {
          userId: job.data.userId,
          createdAt: job.data.createdAt.toISOString(),
        },
      },
    );
```

`RabbitMQPublisherService` создан с `json: true`, значит тело сообщения = `{ "payload": { "userId": ..., "createdAt": ... } }`.

Consumer же читает поля с верхнего уровня:

```108:111:apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts
      await this.notificationService.applyRoutingKey(
        parsedRoutingKey,
        payload as { userId: string; createdAt: string },
      );
```

В результате `payload.userId === undefined` (реальные данные лежат в `payload.payload.userId`), и в WS уходит `sendToUser(undefined, …)`.

**Фикс:** публиковать плоский объект (`{ userId, createdAt }`) **или** распаковывать `payload.payload` в consumer. Лучше — единый контракт события нотификации (DTO) и его переиспользование на обеих сторонах.

---

### [ ] C3. WebSocket‑gateway захардкожен на `user:1`, авторизация отключена
**Файл:** `apps/snapflow-core/src/modules/notifications/websocket/notification-websocket.gateway.ts:39-51`

```39:51:apps/snapflow-core/src/modules/notifications/websocket/notification-websocket.gateway.ts
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected ${client.id}`);
    // const token = client.handshake.auth.token;
    // const payload = this.jwtService.verify(token);
    // const userId = payload.sub;
    // client.data.userId = userId;
    await client.join(`user:${1}`);
  }
```

Любой клиент подключается без токена и попадает в комнату `user:1`. А отправка идёт в `user:${userId}` (`websocket.service.ts:9`). Совпадение возможно только для пользователя с id `1`. То есть нотификация **не доходит** до реального пользователя.

**Фикс:** включить верификацию JWT из `handshake.auth.token`, извлекать `userId` из токена и джойнить `user:${userId}`. Раскомментировать/доинжектить `JwtService`/`AccessTokenProvider`. Обрабатывать отсутствие/невалидность токена (disconnect).

---

### [ ] C4. Poison message: бесконечный requeue при любой ошибке
**Файлы:** оба consumer'а — `notifications-events-consumer.ts:116`, `payments-events.consumer.ts:108`

```113:117:apps/snapflow-core/src/modules/notifications/websocket/notifications-events-consumer.ts
    } catch (error) {
      this.logger.error(error, this.handleMessage.name);
      channel.nack(msg, false, true);
    }
```

`nack(msg, false, true)` возвращает сообщение в очередь с `requeue=true`. Если payload «битый» (например, невалидный JSON или стабильно падающий обработчик), сообщение будет переотправляться **вечно**. С учётом `prefetch(1)` одно poison‑сообщение способно заблокировать обработку всей очереди.

**Фикс:** ввести DLQ (dead‑letter exchange/queue) и/или ограничение количества попыток (`x-delivery-count`/заголовок счётчика). Невалидный JSON или непроходящую валидацию — `nack(false, false)` (в DLQ), а не бесконечный requeue.

---

## 4. Высокий приоритет 🟠

### [ ] H1. Неверный текст/тип нотификации для активации
**Файл:** `apps/snapflow-core/src/modules/notifications/websocket/services/websocket-notification.service.ts:82-94`

Для `SubscriptionActivated` отправляется нотификация про **истечение через 7 дней**:

```82:94:apps/snapflow-core/src/modules/notifications/websocket/services/websocket-notification.service.ts
  private sendMessageByWS(payload: { userId: string; createdAt: string }): void {
    this.webSocketService.sendToUser(payload.userId, {
      type: 'SUBSCRIPTION_EXPIRES_7D',
      title: 'Подписка',
      message: 'Ваша подписка истекает через 7 дней',
      createdAt: new Date().toISOString(),
      expDate: payload.createdAt,
    });
  }
```

Для события активации текст/`type` должны быть про активацию (например, `SUBSCRIPTION_ACTIVATED`, «Подписка активирована»). Поле `expDate` берётся из `createdAt`, что семантически путает (см. L2).

**Фикс:** отдельный билд нотификации под каждый routing key; для активации — корректные `type`/`title`/`message`.

---

### [ ] H2. Нотификация публикуется в обход outbox → нет атомарности с транзакцией
**Файл:** `apps/payments/.../checkout-session-completed-handler.ts:202-216`

Доменное событие пишется в outbox (надёжно, в той же транзакции), а нотификация добавляется в BullMQ напрямую:

```213:216:apps/payments/src/modules/subscriptions/application/webhook/handlers/checkout-session-completed-handler.ts
        await this.queueService.addSubscriptionActivatedJob({
          userId: localCustomer.userId,
          createdAt: currentPeriod.end,
        });
```

`queue.add()` не входит в DB‑транзакцию. Если транзакция после этого откатится, нотификация всё равно уйдёт (ложная нотификация об активации). И наоборот — при падении до коммита может потеряться. Кроме того, два разных механизма доставки (outbox vs Bull) для одного бизнес‑факта усложняют сопровождение.

**Фикс (рекомендация):** проводить событие нотификации тоже через outbox (отдельный `OutboxEventType`/routing key) — тогда оно атомарно с активацией и доставляется тем же надёжным механизмом. BullMQ оставить только там, где реально нужны отложенные задачи (expire 7d/1d, reminders).

---

### [ ] H3. Рассинхрон типа `userId` (number vs string)
**Файлы:** контракт vs processor vs consumer

- Контракт `SubscriptionActivatedEvent.userId: number` (`payment-subscription-activated.event.ts:2`).
- `addSubscriptionActivatedJob({ userId: number, … })` (`queue.service.ts:13`) — number.
- `SubscriptionProcessor.handleActivatedJob(job: Job<{ userId: string; … }>)` (`subscription.processor.ts:31`) — заявлен string.
- Consumer трактует `payload as { userId: string; … }` (`notifications-events-consumer.ts:110`).
- Type‑guard `isSubscriptionActivatedEvent` проверяет `typeof payload.userId === 'number'` (`notification-events.type-guards.ts:24`).

Сейчас на рантайме это number, но объявленные типы лгут. При попытке включить валидацию (см. H4) guard «number» не сойдётся с предполагаемым string.

**Фикс:** зафиксировать один тип `userId` в общем контракте события нотификации и использовать его везде (publisher, processor, consumer, guard).

---

### [ ] H4. Валидация payload в нотификациях отключена
**Файл:** `websocket-notification.service.ts:25-29` (закомментировано) + `notification-events.type-guards.ts`

Проверка `isSubscriptionActivatedEvent(payload)` закомментирована, и обработчик слепо доверяет форме данных. В сочетании с C2 это приводит к молчаливой отправке `undefined`.

**Фикс:** ввести и применять type‑guard под фактический контракт события нотификации; при невалидном payload — лог + отправка в DLQ (а не requeue).

---

## 5. Средний приоритет 🟡

### [ ] M1. Отладочные `console.log`/`console.error` в проде
Разбросаны по коду: `'hello from dispatcher'`, `'hello from consumer'`, `'event consumed in consumer'` (`notifications-events-consumer.ts:84,94,106`), `'CONSUMER PID'` (`payments-events.consumer.ts:37`), `'NotificationModule loaded'` (`notification-module.ts:45`), `'Payload sent via websocket'` (`websocket.service.ts:10`), `console.log(job)` (`subscription.processor.ts:16-17`), `DISCONNECTED/CHANNEL ERROR/CHANNEL CLOSED`.
**Фикс:** заменить на `ContextLogger` с нужным уровнем, убрать мусорные логи.

### [ ] M2. Нет DLQ / лимита ретраев / backoff
Связано с C4. Нужен dead‑letter exchange + политика повторов (ограниченное число, экспоненциальная задержка).

### [ ] M3. Возможная коллизия `jobId` дедупликации в BullMQ
**Файл:** `queue.service.ts:18` — `jobId: activated-${payload.createdAt.toISOString()}`. `createdAt` = `currentPeriod.end`. Если у двух пользователей совпадёт конец периода, второй job будет отброшен дедупликацией BullMQ → пользователь не получит нотификацию.
**Фикс:** включить в `jobId` `userId`/`subscriptionId` (например, `activated-${subscriptionId}-${userId}`).

### [ ] M4. Несколько отдельных подключений к RabbitMQ
Publisher и каждый consumer открывают своё `amqp.connect`. Для текущего этапа допустимо, но стоит вынести подключение в общий провайдер/модуль (`libs/common/messaging`) и переиспользовать.

### [ ] M5. `WebsocketService.sendToUser(payload: any)` — нетипизировано
**Файл:** `websocket.service.ts:8`. Завести тип нотификации (DTO) и `userId` согласовать по типу (см. H3).

### [ ] M6. Неверный импорт `Configuration`
**Файл:** `notification-module.ts:4` — `import { Configuration } from '@nestjs/cli/lib/configuration';`. Это тип из dev‑пакета `@nestjs/cli`, а не конфиг приложения. Нужно использовать собственный `Configuration` (как в остальных модулях: `../../setup/configuration/configuration`).

### [ ] M7. Env‑переменные очередей не описаны в `.env.example`
В `.env.example` нет `PAYMENTS_EVENTS_QUEUE_NAME`, `NOTIFICATIONS_EVENTS_QUEUE_NAME`, `RABBITMQ_URL`. При деплое легко словить падение конфигурации. Добавить с примерами значений.

### [ ] M8. Несогласованная обработка disconnect/reconnect между потребителями
`NotificationEventsConsumer` логирует disconnect через `console.error`, `PaymentsEventsConsumer` вообще не вешает `disconnect`‑хендлер. Привести к единому виду через `ContextLogger`.

---

## 6. Низкий приоритет / косметика ⚪

### [ ] L1. Несогласованные значения в `NotificationsRoutingKey`
`SUBSCRIPTION_ACTIVATED_NOTIFICATION` (SCREAMING_SNAKE) рядом с `SubscriptionExpiringIn7Days`, `NextPaymentRemindIn1` (PascalCase, опечатка «Remind»). Привести к единому стилю.

### [ ] L2. Семантика `createdAt`
В нотификацию `createdAt = currentPeriod.end`, а затем используется как `expDate`. Поле названо как дата создания, а несёт дату окончания. Переименовать/разнести поля.

### [ ] L3. Мёртвый код
Большие закомментированные блоки в `websocket-notification.service.ts` и `notification-events.type-guards.ts`, комментарий `//todo убрать as` (`notifications-events-consumer.ts:109`). Почистить по мере доведения модуля.

### [ ] L4. `NotificationModule` ничего не экспортирует
`exports: []` — gateway/WS‑сервис нельзя переиспользовать (в `user-accounts.module.ts:121` импорт закомментирован). Решить, нужен ли реэкспорт.

---

## 7. Что сделано хорошо ✅

- Транзакционный **outbox** для доменных событий: `lockEventsForProcessing` через `FOR UPDATE SKIP LOCKED`, восстановление «зависших» (`recoverStaleEvents`), статусы PENDING/PROCESSING/PROCESSED/FAILED.
- Проброс `requestId` между сервисами через AMQP‑заголовки + `AsyncLocalStorage` (`amqp-headers.ts`, `dispatchMessageWithRequestContext`).
- `prefetch(1)`, durable exchange/queue, `persistent` сообщения.
- Разделение контрактов в `libs/contracts/payments` и type‑guards для доменной стороны (`PaymentsUserSyncService` валидирует payload).
- Graceful shutdown (`onModuleDestroy` закрывает channel/connection).

---

## 8. Рекомендуемый порядок исправлений

1. **C1** — развести очереди (`notificationsEventsQueueName`). Без этого остальное не имеет смысла.
2. **C2** — выровнять форму payload между publisher и consumer (единый DTO).
3. **C3** — включить JWT‑авторизацию в gateway и джойнить реальную комнату `user:${userId}`.
4. **C4 + M2** — DLQ и лимит ретраев вместо вечного requeue.
5. **H1/H3/H4** — корректный контент нотификации, единый тип `userId`, включить валидацию.
6. **H2** — перевести событие нотификации на outbox (атомарность).
7. **M1/M3/M5/M6/M7/M8** — чистка логов, дедуп jobId, типы, импорт Configuration, env, единый стиль reconnect.
8. **L1–L4** — косметика и удаление мёртвого кода.

---

## 9. Чек‑лист «готово к доведению промежуточного варианта»

- [ ] Нотификации читаются из отдельной очереди `notificationsEventsQueueName` (C1)
- [ ] Payload события активации согласован end‑to‑end, `userId` доходит не `undefined` (C2)
- [ ] WS‑клиент авторизуется по JWT и попадает в свою комнату `user:${userId}` (C3)
- [ ] Нет бесконечного requeue; настроен DLQ/лимит ретраев (C4, M2)
- [ ] Текст и `type` нотификации соответствуют активации подписки (H1)
- [ ] Единый тип `userId` в контракте/processor/consumer/guard (H3)
- [ ] Включена валидация payload нотификации (H4)
- [ ] Событие нотификации эмитится атомарно с активацией (через outbox) (H2)
- [ ] Убраны отладочные `console.*`, логирование через `ContextLogger` (M1)
- [ ] `jobId` дедупликации уникален per‑user/subscription (M3)
- [ ] Исправлен импорт `Configuration` в `NotificationModule` (M6)
- [ ] В `.env.example` добавлены `RABBITMQ_URL`, `PAYMENTS_EVENTS_QUEUE_NAME`, `NOTIFICATIONS_EVENTS_QUEUE_NAME` (M7)
- [ ] Ручная проверка e2e: активация подписки → пользователь получил WS‑нотификацию
