# Code review: `InvoicePaymentSucceededHandler`

Ревью `invoice-payment-succeeded-handler.ts` с фокусом на прод-риски и несогласованности с соседним кодом.

## Критичные / высокий риск

### 1. Рассинхрон с Stripe при «тихом» успехе после ошибки разбора платежа

После успешного `retrieveSubscriptionBillingPeriod` при ошибке `retrieveSucceededPaymentFromInvoice` обработчик возвращает `Notification.ok()` и **ничего не пишет в БД**. В Stripe инвойс уже оплачен и период подписки уже сдвинут, а локально остаются старые `currentPeriod*` и нет платежа/outbox.

Это хуже, чем вернуть ошибку и дать Stripe повторить вебхук: сейчас ретрай не обязательно исправит ситуацию, если повтор придёт с тем же `event.created` и сработает `checkIsOldEvent` (см. п. 2).

### 2. Идемпотентность и повторные доставки вебхуков

`checkIsOldEvent` считает событие «старым» только если `event.created` **строго меньше** `lastStripeEventAt`:

```ts
// utils/check-is-old-event.ts
export function checkIsOldEvent(event: Stripe.Event, localSub: Subscription) {
  return localSub.lastStripeEventAt && new Date(event.created * 1000) < localSub.lastStripeEventAt;
}
```

При **повторной** доставке **того же** события (тот же `created`) после успешной обработки: `lastStripeEventAt` обычно равен дате события → условие ложно → обработка идёт снова → возможны **второй платёж** и **второй outbox** в одной транзакции. Отдельной защиты по `event.id` в обработчике нет.

### 3. Два запроса в Stripe при уже полном вебхуке

Сначала `retrieveSubscriptionBillingPeriod`, затем `retrieveSucceededPaymentFromInvoice` (который снова делает `invoices.retrieve`). Вебхук уже несёт объект инвойса; часть данных могла бы браться из `payload` (с оговорками по `expand`), что уменьшило бы задержки и точки отказа. Сейчас это осознанный trade-off, но он усиливает проблему п. 1 при сбое второго запроса.

---

## Средний риск / качество

### 4. Несогласованность `planId` в outbox и в платеже

В транзакции платёж создаётся с `renewedSubscription.planId`, а в outbox явно передаётся `localSubscription.planId`. В норме это одно и то же, но после возможных будущих изменений в `renewSubscription` надёжнее опираться на **один** объект (`renewedSubscription`) для обоих полей.

### 5. Семантика `SUBSCRIPTION_ACTIVATED` на продлении

Для продления снова шлётся `OutboxEventType.SUBSCRIPTION_ACTIVATED` с тем же контрактом, что и при первом включении после checkout. Подписчики событий могут не отличать «первую активацию» от «продления» — если это не задокументировано в контракте, это источник багов на стороне core/уведомлений.

### 6. Ошибка в тексте в `StripeService` (на пути хендлера)

При падении `invoices.retrieve` возвращается сообщение «Failed to retrieve **subscription** from the payment provider» — фактически падает загрузка **инвойса**. Вводит в заблуждение при логах/алертах.

### 7. Жёсткая привязка продления к `billing_reason === 'subscription_cycle'`

Как и в `invoice-payment-failed`, другие сценарии Stripe (`subscription_update` и т.д.) молча пропускаются. Если в аккаунте Stripe появятся нестандартные счета, продление может не отразиться в БД.

### 8. Импорт `InternalServerException`

Длинный относительный путь в `snapflow-core` хрупок для рефакторинга; лучше единый алиас/публичный entry пакета, как принято в монорепе.

---

## Низкий риск / стиль

### 9. Логирование при пропуске «старого» события

В `InvoicePaymentFailedHandler` при старом событии есть `logger.log`, в `InvoicePaymentSucceededHandler` — тихий `return ok()`. Для симметрии и отладки повторов можно логировать так же.

### 10. Комментарий про пропуск при создании подписки

Комментарий про `isSubscriptionRenewal` верен для типичного checkout; при смене продуктовой логики его стоит держать в синхроне с фактическим контрактом Stripe.

---

## Краткий вывод

Главные проблемы:

1. Тихий `ok` при ошибке получения платежа после успешного чтения периода → риск **постоянного** рассинхона с Stripe.
2. Слабая идемпотентность при **повторной** доставке того же события → риск **дублирования** платежей и outbox.

Остальное — консистентность полей, семантика события для продлений и UX сообщений в Stripe-слое.

**Возможные направления правок:** дедуп по `event.id`, уточнение сравнения для `lastStripeEventAt`, единая политика при ошибке `retrieveSucceededPaymentFromInvoice`, выравнивание `planId`.
