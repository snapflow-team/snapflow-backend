# Payments Service — инструкция для фронтенда и QA

Документ описывает, как пользоваться публичным HTTP API микросервиса `apps/payments` и как тестировать сценарии оплаты через Stripe Checkout. Все вебхуки и служебные маршруты здесь упоминаются только для контекста — фронтом и QA напрямую не вызываются.


## 1. Базовые сведения

| Параметр | Значение |
| --- | --- |
| Префикс всех маршрутов | `/api/v1` |
| Тег в Swagger | `Subscriptions` |
| Авторизация (где требуется) | `Authorization: Bearer <accessToken>` (тот же JWT, что и для core) |
| Content-Type для тел запросов | `application/json` |
| Кодировка сумм | minor units (центы). Например, `1000` = `10.00 USD` |
| Currency | задаётся в Stripe Dashboard на конкретном Price ID |
| Валидация DTO | глобальный `ValidationPipe`, ошибки приходят как `400 Bad Request` |
| Документация | Swagger UI: `http://<host>:<port>/api/v1/<SWAGGER_PATH>` (в dev — без basic-auth, в остальных env — с basic-auth) |

### Тарифные планы

| `id` | `label` | Цена (minor units) | Длительность |
| --- | --- | --- | --- |
| `business_monthly` | `Business Monthly` | `1000` | 30 дней |
| `business_yearly` | `Business Yearly` | `9000` | 360 дней |

Эти `id` нужно использовать в теле запроса при создании Checkout Session.


## 2. Жизненный цикл подписки

- `PENDING` — пользователь начал чекаут, но ещё не оплатил 
- `ACTIVE` — оплата прошла, подписка активна, Stripe сам её продлевает.
- `PAST_DUE` — подписка закончилась, но Stripe ещё пытается списать деньги для продления.
- `CANCELLED` — подписка отменена/expired (можно создавать новую).

Ключевые сценарии:

1. **Нет подписки или последняя `CANCELLED`** → создаётся **новая** Checkout Session в `mode = subscription` (рекуррентные платежи).
2. **Активная подписка (`ACTIVE`)** → создаётся **продлевающая** Checkout Session в `mode = payment` (одноразовый платёж, продлевает текущую подписку).
3. **`PENDING` или `PAST_DUE`** → новая сессия не создастся, фронт получит `400` с понятным сообщением (нужно дождаться оплаты или отменить старую).


## 3. Эндпоинты

### 3.1 GET `/api/v1/subscriptions/plans`

Возвращает список доступных тарифов. **Без авторизации.**

**Пример запроса:**

```http
GET /api/v1/subscriptions/plans
```

**Пример ответа `200 OK`:**

```json
[
  {
    "id": "business_monthly",
    "label": "Business Monthly",
    "priceInCents": 1000
  },
  {
    "id": "business_yearly",
    "label": "Business Yearly",
    "priceInCents": 9000
  }
]
```

### 3.2 POST `/api/v1/subscriptions/stripe/checkout-session`

Создаёт Stripe Checkout Session и возвращает URL, на который **нужно сделать redirect** пользователя. **Требует авторизации.**

**Headers:**

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body (`CreateCheckoutSessionInputDto`):**

```json
{
  "planId": "business_monthly"
}
```

**Пример ответа `201 Created` (`CheckoutSessionUrlViewDto`):**

```json
{
  "url": "https://checkout.stripe.com/c/pay_1234567890abcdef"
}
```

**Что делать на фронте:**

1. Получить `url`.
2. Сделать `window.location.assign(url)` (или открыть в новой вкладке — на усмотрение продукта).
3. После оплаты Stripe сам редиректнет пользователя на `STRIPE_SUCCESS_URL` или `STRIPE_CANCEL_URL` (заданы в env). На странице успеха в query-строке будет `?session_id=cs_test_...`.
4. Состояние подписки на бэке появится **только после прихода вебхука** `checkout.session.completed`. До этого момента не считайте подписку активной — лучше показать пользователю "Платёж обрабатывается" и опросить `GET /subscriptions/my-payments` или статус с задержкой 2–5 секунд.

**Возможные ошибки:**

| HTTP | Причина |
| --- | --- |
| `400` | Передан несуществующий `planId`, либо у пользователя есть `PENDING`/`PAST_DUE` подписка |
| `401` | Нет/невалидный/просроченный access-токен |
| `500` | Не удалось связаться со Stripe или внутренняя ошибка БД |

**Важно для QA:**

- При первой подписке у пользователя в Stripe создастся новый `Customer` (`cus_***`). У последующих сессий используется этот же customer.
- Если вызвать эндпоинт два раза подряд для одного и того же `planId` без оплаты — каждый раз создаётся новая Checkout Session (старые `PENDING` Session’ы протухают по `checkout.session.expired`).

---

### 3.3 PUT `/api/v1/subscriptions/stripe/auto-renewal`

Включает или отключает авто-продление подписки. **Требует авторизации.**

> Технически в Stripe этот флаг — `cancel_at_period_end`. У нас сервис принимает `autoRenewal: boolean`, где `true` означает, что подписка **продолжит** автоматически продлеваться, `false` — что после окончания текущего периода Stripe её больше не продлит.

**Headers:**

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body (`UpdateAutoRenewalInputDto`):**

```json
{
  "autoRenewal": false
}
```

**Ответ:** `204 No Content` — без тела.

> Если пришедшее значение совпадает с текущим (например, авто-продление и так включено, и пришло `true`) — всё равно вернётся `204`, никаких ошибок.

**Возможные ошибки:**

| HTTP | Причина |
| --- | --- |
| `400` | У пользователя нет активной (`ACTIVE`/`PAST_DUE`) подписки |
| `401` | Нет/невалидный access-токен |
| `500` | Сбой Stripe или БД |

---

### 3.4 GET `/api/v1/subscriptions/my-payments`

Возвращает **только успешные** (`status = PAID`) платежи текущего пользователя, постранично. **Требует авторизации.**

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Query-параметры (`GetPaymentsQueryParams`):**

| Параметр | Тип | По умолчанию | Допустимые значения |
| --- | --- | --- | --- |
| `pageNumber` | number | `1` | положительное целое |
| `pageSize` | number | `10` | положительное целое |
| `sortBy` | enum | `createdAt` | `createdAt`, `provider`, `status`, `planId` |
| `sortDirection` | enum | `desc` | `asc`, `desc` |

**Пример запроса:**

```http
GET /api/v1/subscriptions/my-payments?pageNumber=1&pageSize=10&sortBy=createdAt&sortDirection=desc
```

**Пример ответа `200 OK` (`PaginatedPaymentsSwaggerDto`):**

```json
{
  "items": [
    {
      "userId": "1",
      "subscriptionId": "42",
      "dateOfPayment": "2026-04-21T10:30:00.000Z",
      "endDateOfSubscription": "2026-05-21T10:30:00.000Z",
      "price": 1000,
      "subscriptionType": "Business Monthly",
      "provider": "STRIPE"
    }
  ],
  "totalCount": 1,
  "pagesCount": 1,
  "page": 1,
  "pageSize": 10
}
```

**Возможные ошибки:**

| HTTP | Причина |
| --- | --- |
| `400` | Невалидные query-параметры (например, `sortBy=foo`) |
| `401` | Нет/невалидный access-токен |

---

## 4. Полный happy-path для фронта

1. `GET /subscriptions/plans` → отрисовать тарифы.
2. Пользователь нажал «Оформить **Business Monthly**».
3. `POST /subscriptions/stripe/checkout-session` с `{ "planId": "business_monthly" }` → получить `url`.
4. Редирект на `url` → Stripe Checkout.
5. Пользователь оплачивает → Stripe редиректит на `STRIPE_SUCCESS_URL?session_id=cs_test_...`.
6. На странице успеха фронт может:
   - сразу позвать `GET /subscriptions/my-payments` (с небольшой задержкой/повтором, так как вебхук может прийти не мгновенно), либо
   - показать "Платёж обрабатывается" и слушать обновления через polling/websocket (если такой контракт уже согласован).
7. По кнопке «Отключить авто-продление» → `PUT /subscriptions/stripe/auto-renewal` с `{ "autoRenewal": false }`.

---

## 5. Тестовые карты Stripe

> Карты работают **только** в test-mode Stripe (когда сервис настроен на тестовые ключи `sk_test_***`). Любая дата истечения в будущем (например, `12/34`), любой CVC из 3 цифр (например, `123`), любой ZIP/postal (например, `12345`).

> Если в Checkout Session активирован 3D Secure / Strong Customer Authentication, в превью платежа появится модалка «Authenticate». Жмём `Complete authentication` — успех; `Fail authentication` — отказ.

### 5.1 Успешные оплаты (happy-path)

| Номер карты | Бренд | Что проверяет |
| --- | --- | --- |
| `4242 4242 4242 4242` | Visa | Базовый успешный платёж без 3DS. **Главная карта для smoke-тестов.** |
| `4000 0566 5566 5556` | Visa (debit) | Дебетовая карта, успешно проходит. |
| `5555 5555 5555 4444` | Mastercard | Базовый успешный платёж Mastercard. |
| `2223 0031 2200 3222` | Mastercard (2-series) | Mastercard диапазона `2-series`. |
| `5200 8282 8282 8210` | Mastercard (debit) | Дебетовая Mastercard. |
| `5105 1051 0510 5100` | Mastercard (prepaid) | Prepaid Mastercard. |
| `3782 822463 10005` | American Express | Успешный платёж AmEx (CVC 4 цифры, например `1234`). |
| `3714 496353 98431` | American Express | Альтернативная AmEx. |
| `6011 1111 1111 1117` | Discover | Discover, успех. |
| `3056 9300 0902 0004` | Diners Club | Diners Club, успех. |
| `6200 0000 0000 0005` | UnionPay | UnionPay, успех. |
| `3566 0020 2036 0505` | JCB | JCB, успех. |


### 5.2 Отказы платежа (`card_declined` и др.)

| Номер карты | Код ошибки | Что проверяет |
| --- | --- | --- |
| `4000 0000 0000 0002` | `card_declined` (`generic_decline`) | Самый «общий» отказ — банк не пропустил оплату. |
| `4000 0000 0000 9995` | `card_declined` (`insufficient_funds`) | Недостаточно средств. |
| `4000 0000 0000 9987` | `card_declined` (`lost_card`) | Карта помечена как утерянная. |
| `4000 0000 0000 9979` | `card_declined` (`stolen_card`) | Карта помечена как украденная. |
| `4000 0000 0000 0069` | `expired_card` | Карта просрочена. |
| `4000 0000 0000 0127` | `incorrect_cvc` | Неверный CVC. |
| `4000 0000 0000 0119` | `processing_error` | Ошибка процессинга на стороне Stripe/банка. |
| `4242 4242 4242 4241` | `incorrect_number` | Неверный номер карты (Luhn fail). |
| `4000 0000 0000 0259` | dispute → `fraudulent` | Платёж пройдёт, но через какое-то время прилетит chargeback по причине мошенничества. |
| `4000 0000 0000 1976` | dispute → `product_not_received` | Платёж пройдёт, потом — chargeback. |

### 5.3 Поведение в Checkout Session (важно для QA)

- Если карта отклоняется **до создания подписки**, Checkout Session останется открытой, пользователь сможет ввести другую карту. Никаких изменений в нашей БД не произойдёт.
- Если пользователь закрыл вкладку / вышел по `cancel_url`, через ~24 часа Stripe пришлёт `checkout.session.expired` → подписка перейдёт в `CANCELLED`.
- При успехе придёт `checkout.session.completed` → подписка `ACTIVE`, в `my-payments` появится запись.
- Для проверки сценария «продление прошло успешно» (`invoice.payment_succeeded`) и «продление зафейлилось» (`invoice.payment_failed`) удобнее всего использовать **Stripe CLI**: `stripe trigger invoice.payment_succeeded` и `stripe trigger invoice.payment_failed`. Реальное «дождаться следующего месяца» в test-mode не нужно.

### 5.5 Локальная отладка вебхуков (для QA, опционально)

Если нужно гонять реальные вебхуки Stripe на локальный backend:

```bash
stripe login
stripe listen --forward-to localhost:<PORT>/api/v1/payments/stripe/webhook
```

Stripe выдаст в консоль `whsec_***` — это значение должно лежать в `STRIPE_WEBHOOK_SECRET` для текущего окружения. После этого любые тестовые оплаты Stripe будут зеркалиться в наш сервис.

---

## 6. Чек-лист для QA

### 6.1 Smoke (минимальный набор)

- [ ] `GET /subscriptions/plans` — оба плана возвращаются с корректными ценами.
- [ ] Без `Authorization` — `POST /subscriptions/stripe/checkout-session` отдаёт `401`.
- [ ] С валидным токеном и `planId = business_monthly` — приходит `url`, редирект на Stripe работает.
- [ ] Оплата картой `4242 4242 4242 4242` → после редиректа в `my-payments` появляется запись со статусом `PAID`.
- [ ] `PUT /subscriptions/stripe/auto-renewal` с `false` → `204`, повторный вызов с `false` снова `204`.
- [ ] `PUT /subscriptions/stripe/auto-renewal` без активной подписки → `400`.

### 6.2 Негативные сценарии

- [ ] `planId: "i_dont_exist"` → `400` с описанием в extensions.
- [ ] Карта `4000 0000 0000 0002` → платёж не проходит, в БД ничего не меняется.
- [ ] Карта `4000 0025 0000 3155` (3DS) → требуется аутентификация, после успеха — подписка `ACTIVE`.
- [ ] Карта `4000 0027 6000 3184` → 3DS-челлендж проваливается, подписка не активируется.
- [ ] Закрыть Checkout (cancel) → дождаться `checkout.session.expired` (или эмулировать через Stripe CLI: `stripe trigger checkout.session.expired`) → подписка `CANCELLED`.
- [ ] Попытка создать новую сессию при `PENDING`/`PAST_DUE` → `400`.

### 6.3 Идемпотентность

- [ ] Прислать один и тот же вебхук дважды (через `stripe events resend <evt_id>`) — обработается **только один раз** (см. ключ `stripe_webhook_processed:<event.id>` в Redis, TTL 24 часа).

---

## 7. Ошибки и формат ответа

Сервис использует общий `GlobalExceptionFilter` и нотификации (`Notification` / `NotificationResultCode`). Структура ошибок единообразна:

```json
{
  "errorsMessages": [
    {
      "message": "Failed to initiate payment for the order",
      "field": "planId"
    }
  ]
}
```

Коды:

- `400 Bad Request` — невалидный ввод/бизнес-правила.
- `401 Unauthorized` — отсутствует или невалидный access-токен.
- `404 Not Found` — несуществующий ресурс.
- `500 Internal Server Error` — Stripe/БД/неизвестная ошибка. Для прод-окружения детали скрыты, для dev — могут быть видны (зависит от env-флага `SEND_INTERNAL_SERVER_ERROR_DETAILS`).

---

