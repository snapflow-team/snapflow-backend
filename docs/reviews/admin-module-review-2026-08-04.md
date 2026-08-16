# Ревью модуля admin-панели (`apps/snapflow-core/src/modules/admin`)

> Дата ревью: 2026-08-04
> Объём: 64 файла модуля `admin` + смежный контекст (`setup/admin-graphql.module-options.ts`,
> `snapflow-core.module.ts`, `AdminSettings`, `UsersRepository`, `prisma/schema.prisma`,
> внутренний контракт платежей, e2e-тесты `test/05-admin-auth`, `test/06-admin-users`, `test/07-admin-posts`).

---

## 1. Краткий вердикт

Модуль в целом сделан аккуратно: чистое разделение `api / application / domain / infrastructure`,
CQRS через шины, единый контракт ошибок, cookie-сессии вместо токенов в теле, e2e-покрытие на ~2700 строк.
Это заметно выше среднего уровня для админки.

Но есть **3 дефекта, которые ломают функциональность или дают 500 на управляемом извне вводе**,
и **9 проблем высокой важности**, из которых большая часть — производительность и устойчивость
раздела «Платежи» и подписок.

Главное, что нужно чинить в первую очередь:

1. `adminPosts(sortBy: Username)` — гарантированный 500 (Prisma сортирует несуществующее поле).
2. `adminPosts(search: ...)` — `totalCount`/`pagesCount` считаются без учёта поиска → пагинация врёт.
3. Любая невалидная cookie `adminSessionId` → 500 вместо `Unauthorized`.
4. `adminPayments(sortBy: Username)` — выгрузка **всей** таблицы платежей в память на каждый запрос.

Сводка:

| Критичность | Кол-во | Что это в основном |
|---|---|---|
| 🔴 Критичные | 3 | Падения резолверов, неверная пагинация |
| 🟠 Высокие | 9 | Безопасность логина, DoS-векторы, устойчивость интеграции, масштабирование подписок |
| 🟡 Средние | 19 | Функциональные пробелы, качество данных, дублирование, типизация |
| ⚪ Низкие | 12 | Нейминг, структура, документация |

---

## 2. Что сделано хорошо

Отмечаю явно, чтобы это не потерялось при рефакторинге:

- **Слоистость выдержана.** `api` не лезет в Prisma, `application` не знает про GraphQL,
  репозитории возвращают готовые модели. Единственное протекание — `infrastructure/repositories`
  импортирует `api/models`, но для read-моделей CQRS это осознанный и распространённый компромисс.
- **Единый контракт ошибок.** `AdminGqlExceptionsFilter` + `sanitizeGraphqlError`
  (`admin-graphql.module-options.ts:9-29`) — stacktrace вырезан, сырой input не утекает
  в `BAD_USER_INPUT`. Это правильная защита: иначе пароль из `adminLogin` попал бы в текст ошибки.
- **Сессии в httpOnly-cookie**, а не JWT в теле. Ротация id при логине есть → session fixation закрыта.
- **Транзакционные хвосты в репозиториях** (`tx: Prisma.TransactionClient = this.prisma`) —
  единый стиль со всем проектом.
- **e2e-покрытие реальное**, а не формальное: проверяются коды ошибок, `pageInfo`,
  soft-delete, DRAFT-посты, WS-подписка без авторизации.
- **`softDeleteAllActive` при логине** — задокументированное single-session-поведение
  (`docs/admin-graphql.md:54`), а не случайность.

---

## 3. 🔴 Критичные дефекты

### [ ] C1. `adminPosts(sortBy: Username)` всегда падает с 500

**Файлы:** `infrastructure/repositories/admin-posts.query-repository.ts:54-56`,
`domain/enums/admin-posts-sort-field.enum.ts:3-6`

```54:56:apps/snapflow-core/src/modules/admin/infrastructure/repositories/admin-posts.query-repository.ts
        orderBy: {
          [sortBy]: sortDirection === AdminSortDirection.Descending ? 'desc' : 'asc',
        },
```

`AdminPostsSortField.Username` имеет значение `'username'`, и оно подставляется напрямую
ключом в `orderBy` для модели `Post`. Но у `Post` **нет** поля `username`
(`prisma/schema.prisma:228-248`) — оно у связанной `User`. Prisma отвечает
`PrismaClientValidationError`, это не `DomainException`, фильтр его не ловит → Apollo отдаёт
`INTERNAL_SERVER_ERROR`.

Почему это критично: `AdminPostsSortField.Username` объявлен в публичной GraphQL-схеме,
то есть полностью валидный по схеме запрос гарантированно роняет резолвер. Фронт, реализуя
сортировку по колонке «Автор», упрётся в 500 сразу.

**Фикс:**

```ts
const direction: Prisma.SortOrder =
  sortDirection === AdminSortDirection.Descending ? 'desc' : 'asc';

const orderBy: Prisma.PostOrderByWithRelationInput =
  sortBy === AdminPostsSortField.Username
    ? { user: { username: direction } }
    : { [sortBy]: direction };
```

Заодно перестать типизировать `orderBy` неявно: `Prisma.PostOrderByWithRelationInput` поймал бы
эту ошибку на этапе компиляции.

**Тест:** e2e на `sortBy: Username` для `adminPosts` (сейчас в `admin-posts.e2e-spec.ts`
проверяется только `CreatedAt`, строка 184).

---

### [ ] C2. `totalCount` в `adminPosts` игнорирует `search` → пагинация показывает несуществующие страницы

**Файл:** `infrastructure/repositories/admin-posts.query-repository.ts:30-66`

```60:65:apps/snapflow-core/src/modules/admin/infrastructure/repositories/admin-posts.query-repository.ts
      this.prisma.post.count({
        where: {
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
      }),
```

`findMany` использует собранный `where` (с фильтром по `user.username`), а `count` —
свой захардкоженный объект **без** поиска. При активном поиске `totalCount` показывает
общее число постов в системе.

Что видит пользователь: поиск по автору вернул 2 поста, а пагинатор рисует, например, 40 страниц,
и все страницы кроме первой пустые.

**Фикс:** переиспользовать ту же переменную.

```ts
this.prisma.post.count({ where }),
```

**Почему не поймали тесты:** тест «должен фильтровать посты по username»
(`admin-posts.e2e-spec.ts:153-182`) проверяет только `items`, но не `pageInfo`.
Стоит добавить в него `expect(...pageInfo.totalCount).toBe(1)`.

---

### [ ] C3. Невалидная cookie `adminSessionId` даёт 500 вместо `Unauthorized`

**Файлы:** `api/guards/admin-gql-auth.guard.ts:38-49`,
`infrastructure/repositories/admin-sessions.repository.ts:16-29`,
`prisma/schema.prisma:197`

Guard берёт значение cookie как есть и передаёт в запрос:

```67:72:apps/snapflow-core/src/modules/admin/api/guards/admin-gql-auth.guard.ts
  private parseSessionId(req: AdminRequest | WebSocketRequest) {
    if (this.isAdminRequest(req)) {
      const rawSessionId: any = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];

      return typeof rawSessionId === 'string' && rawSessionId.length > 0 ? rawSessionId : null;
    }
```

Проверяется только «строка и непустая». Но `AdminSession.id` объявлен как `String @db.Uuid`,
поэтому `findFirst({ where: { id: 'garbage' } })` завершается ошибкой приведения к UUID
(Prisma `P2023` / Postgres `22P02`). Это не `DomainException` → 500.

Три следствия:
- Любой, кто отправит `Cookie: adminSessionId=x`, получит 500. Это тривиально фаззится
  и зашумляет алерты/логи ошибок.
- Отличить «нет сессии» от «сломан сервер» на фронте нельзя — контракт из
  `docs/admin-graphql.md` (всегда `Unauthorized`) нарушается.
- Внешне управляемый ввод доходит до слоя БД без валидации формата — это плохой паттерн сам по себе.

**Фикс** (в guard, до похода в БД):

```ts
import { isUUID } from 'class-validator';

const sessionId: string | null = this.parseSessionId(ctx.req);

if (!sessionId || !isUUID(sessionId)) {
  throw new UnauthorizedException('Admin is not authenticated');
}
```

**Тест:** e2e-кейс «протухшая/битая cookie → `Unauthorized`» с явно не-UUID значением.

---

## 4. 🟠 Высокая важность

### [ ] H1. Пароль администратора хранится и сравнивается в открытом виде

**Файлы:** `application/usecases/admin-login.usecase.ts:30-34`,
`setup/configuration/admin-settings.ts:8-9`

```32:34:apps/snapflow-core/src/modules/admin/application/usecases/admin-login.usecase.ts
    if (email !== adminSettings.email || password !== adminSettings.password) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
```

Проблемы:
1. `ADMIN_PASSWORD` лежит в окружении **в открытом виде** — утечка env-дампа, логов процесса
   или конфига CI сразу даёт полный доступ к админке.
2. Сравнение `!==` не константное по времени. Практическая эксплуатируемость через сеть низкая,
   но для сравнения секретов это всё равно неприемлемый паттерн.
3. В юзкейс уже инжектится `CryptoService`, у которого есть `createPasswordHash` / `comparePassword`
   на argon2id (`libs/common/services/crypto.service.ts:8-19`) — но используется он только ради
   `generateUUID()`. Инструмент под рукой и не задействован.

**Фикс:** хранить хеш, а не пароль.

```ts
// AdminSettings
this.passwordHash = environmentVariables.ADMIN_PASSWORD_HASH;

// AdminLoginUseCase
const isEmailValid: boolean = timingSafeEqualStrings(email, adminSettings.email);
const isPasswordValid: boolean = await this.cryptoService.comparePassword({
  password,
  hash: adminSettings.passwordHash,
});

if (!isEmailValid || !isPasswordValid) {
  throw new UnauthorizedException('Invalid admin credentials');
}
```

Обратите внимание: `comparePassword` нужно вызывать **всегда**, даже при неверном email,
иначе по времени ответа отличается «нет такого email» от «неверный пароль».

Ключ `ADMIN_PASSWORD_HASH` нужно завести в описаниях окружений
(`apps/snapflow-core/env/.env.{development,testing,production}`) — без реальных значений.

---

### [ ] H2. Нет верхней границы `pageSize` — открытый DoS-вектор

**Файлы:** `api/inputs/admin-users-query.input.ts:15-18`,
`api/inputs/admin-posts-query.input.ts:14-17`,
`api/inputs/admin-payments-query.input.ts:14-17`

Везде только `@Min(1)`. `pageSize: 1000000` пройдёт валидацию.

Для `adminPosts` это особенно дорого: на каждый пост тянутся `postMedias` и `user.profiles`,
то есть один запрос может вытащить сотни тысяч строк с джойнами. `page` тоже не ограничен —
большой `OFFSET` в Postgres линейно деградирует.

**Фикс:** общая константа + `@Max` во всех трёх input'ах.

```ts
// constants/admin-query.defaults.ts
export const ADMIN_MAX_PAGE_SIZE = 100;

// в каждом input
@Field(() => Int, { defaultValue: adminPostsQueryDefaults.pageSize })
@IsOptional()
@Min(1)
@Max(ADMIN_MAX_PAGE_SIZE)
pageSize?: number;
```

Стоит также ограничить глубину/сложность GraphQL-запросов
(`graphql-depth-limit` / `graphql-query-complexity`) в `getAdminGraphqlModuleOptions`.

---

### [ ] H3. Сортировка платежей по username выгружает всю таблицу платежей в память

**Файл:** `application/queries/get-admin-payments.query-handler.ts:69-113`

```78:89:apps/snapflow-core/src/modules/admin/application/queries/get-admin-payments.query-handler.ts
    const response = await this.adminPaymentsHttpClient.getPayments(
      mapAdminPaymentsParamsToInternal(
        new GetAdminPaymentsQueryParams({
          page: 1,
          pageSize: Number.MAX_SAFE_INTEGER,
          search: params.search,
          sortBy: params.sortBy,
          sortDirection: params.sortDirection,
        }),
        userIds.length ? userIds : undefined,
      ),
    );
```

Так как `username` живёт в core, а платежи — в сервисе `payments`, сортировка сделана «в лоб»:
запросить **всё** и отсортировать локально. На стороне payments ограничения тоже нет
(`get-internal-payments-query-params.input-dto.ts:16-19` — только `@Min(1)`), поэтому запрос
реально выполнится.

Стоимость одного клика по колонке «Пользователь» в админке:
полный скан таблицы платежей → сериализация всего набора в JSON → передача по HTTP →
парсинг в память core → `findUsersByIds` по всем уникальным userId → сортировка массива.
Линейно от размера таблицы платежей. Это положит и core, и payments задолго до того,
как данных станет «много».

**Варианты фикса, по возрастанию трудоёмкости:**
1. *Быстро:* жёсткий потолок (например, 5000 записей) + явная ошибка/усечение. Затыкает падение,
   но не решает задачу.
2. *Правильно и умеренно:* инвертировать порядок. Сначала в core взять **страницу пользователей**,
   отсортированную по `username` (offset/keyset по таблице `users`), затем запросить платежи
   только этих userId. Пагинация тогда по пользователям, а не по платежам, — это меняет семантику,
   нужно согласовать с продуктом/фронтом.
3. *Системно:* денормализовать `username` в сервис payments (обновлять по событию смены username),
   после чего сортировка и поиск полностью уезжают в payments, а весь этот класс проблем
   (H3, H4, H5) исчезает разом.

Рекомендую вариант 3 как целевой, вариант 1 — как немедленную заплатку.

---

### [ ] H4. Поиск по платежам передаёт неограниченный список userId в query string → риск 414

**Файлы:** `application/queries/get-admin-payments.query-handler.ts:115-121`,
`infrastructure/repositories/admin-users.query-repository.ts:110-123`,
`infrastructure/clients/admin-payments-http.client.ts:44`

`findUserIdsByUsernameSearch` возвращает **все** совпадения без `take`, а клиент склеивает их
в `userIds=1,2,3,...`:

```44:44:apps/snapflow-core/src/modules/admin/infrastructure/clients/admin-payments-http.client.ts
          ...(params.userIds?.length ? { userIds: params.userIds.join(',') } : {}),
```

Поиск по строке `a` в базе на 100k пользователей даст десятки тысяч id — это сотни килобайт
в URL. Nginx (`large_client_header_buffers`, по умолчанию 8k) и Node
(`--max-http-header-size`, 16k) обрежут запрос: `414 URI Too Long` / `431`. Ошибка при этом
прилетит как необработанная axios-ошибка → 500 в админке.

**Фикс:** любой из вариантов H3 (особенно вариант 3). Как временная мера — перевести
internal-эндпоинт платежей на `POST` с телом либо ограничить выборку userId с явным
сообщением «уточните поиск».

---

### [ ] H5. `totalCount` платежей не совпадает с фактическим числом элементов на странице

**Файл:** `application/queries/get-admin-payments.query-handler.ts:123-147`

```127:134:apps/snapflow-core/src/modules/admin/application/queries/get-admin-payments.query-handler.ts
    return payments.flatMap((payment) => {
      const userId: number = Number(payment.userId);
      const user: AdminUserBrief | undefined = usersById.get(userId);

      if (!user) {
        return [];
      }
```

Платежи пользователей, которых нет в core или которые soft-deleted, молча выбрасываются.
Но `totalCount`/`pagesCount` берутся из ответа payments-сервиса (строки 60-64), где эти платежи
посчитаны. Итог: страница на 6 элементов может вернуть 3, при `totalCount: 40`;
теоретически страница может оказаться и полностью пустой.

Дополнительно `Number(payment.userId)` не защищён от `NaN` — контракт объявляет `userId: string`
(`internal-payments-api.contract.ts:28`).

**Фикс:** выбрать одну из стратегий и придерживаться её.
- Показывать удалённых как плейсхолдер (`username: 'Deleted user'`, `avatarUrl: null`) —
  тогда счётчики сходятся и админ видит полную финансовую картину. Для админки это обычно
  предпочтительнее: платежи удалённых пользователей — реальные деньги, их нельзя прятать.
- Либо фильтровать на стороне payments, передавая список активных userId, и брать `totalCount` оттуда.

---

### [ ] H6. HTTP-клиент платежей без таймаута, ретраев и обработки ошибок

**Файлы:** `admin.module.ts:58`, `infrastructure/clients/admin-payments-http.client.ts:34-47`

`HttpModule` подключён без конфигурации, значит таймаут axios по умолчанию — `0` (бесконечный).
Вокруг `firstValueFrom` нет `try/catch`.

Последствия: если payments-сервис завис, запрос админки висит до таймаута балансировщика,
удерживая соединение и event-loop-задачи. Если payments вернул 500/ECONNREFUSED — наружу
уходит `INTERNAL_SERVER_ERROR` без внятного кода, и фронт не может отличить «сервис платежей
недоступен» от «баг в админке».

**Фикс:**

```ts
// admin.module.ts
HttpModule.register({ timeout: 5000, maxRedirects: 0 }),
```

```ts
// admin-payments-http.client.ts
try {
  const response = await firstValueFrom(this.httpService.get<...>(url, { ... }));
  return response.data;
} catch (error) {
  this.logger.error(`Payments service request failed: ${url}`, error);
  throw new ServiceUnavailableException('Payments service is temporarily unavailable');
}
```

Нужен доменный код ошибки для «внешний сервис недоступен» — проверить, есть ли он
в `CommonDomainExceptionCode`, и добавить, если нет; затем задокументировать в `admin-graphql.md`.

---

### [ ] H7. WS-подписка авторизуется один раз и живёт вечно

**Файл:** `api/resolvers/admin-posts.resolver.ts:40-46`

```40:46:apps/snapflow-core/src/modules/admin/api/resolvers/admin-posts.resolver.ts
  @UseGuards(AdminGqlAuthGuard)
  @Subscription(() => AdminPostListItemModel, {
    name: SubscriptionHandlerName,
  })
  postCreated() {
    return this.pubSub.asyncIterableIterator(POST_CREATED_EVENT);
  }
```

Guard отрабатывает только в момент `subscribe`. Дальше поток живёт, пока открыт сокет:
`adminLogout` и истечение `expiresAt` его не рвут. Админ «вышел», а его браузер продолжает
получать данные о всех новых постах платформы.

**Фикс (варианты, можно комбинировать):**
- Периодическая ревалидация сессии внутри итератора (обёртка, которая раз в N секунд
  проверяет `findActiveById` и завершает поток при отсутствии сессии).
- В `AdminLogoutUseCase` публиковать событие разрыва и закрывать соответствующие сокеты.
- Как минимум — ограничить максимальное время жизни WS-соединения и заставить клиент
  переподключаться (при переподключении guard отработает заново).

---

### [ ] H8. In-memory `PubSub` не переживёт горизонтальное масштабирование

**Файл:** `providers/pub-sub.provider.ts:5-8`

```5:8:apps/snapflow-core/src/modules/admin/providers/pub-sub.provider.ts
export const pubSubProvider: Provider<PubSub> = {
  provide: PUB_SUB,
  useValue: new PubSub(),
};
```

`PubSub` из `graphql-subscriptions` — это EventEmitter в памяти процесса. При двух и более
инстансах core событие `PostCreated`, обработанное инстансом A, увидят только админы,
чей WebSocket висит на инстансе A. Подписка станет отдавать данные «через раз» — и это
именно тот класс багов, который ловится только в проде.

**Фикс:** Redis уже есть в проекте (`ApiSettings.redisUrl`) — перейти на
`graphql-redis-subscriptions` и вынести создание провайдера в фабрику с `ConfigService`.
Если горизонтальное масштабирование пока не планируется, это надо зафиксировать
комментарием в провайдере и в `docs/admin-graphql.md` как известное ограничение.

---

### [ ] H9. Разбор cookie в WebSocket-ветке guard'а: префиксное совпадение и хардкод имени

**Файл:** `api/guards/admin-gql-auth.guard.ts:73-95`

```87:92:apps/snapflow-core/src/modules/admin/api/guards/admin-gql-auth.guard.ts
      const adminSessionIdCookie = cookieString
        .split('; ')
        .find((cookieStr) => cookieStr.startsWith('adminSessionId'))
        ?.split('=')[1];
```

Три дефекта в четырёх строках:
1. `startsWith('adminSessionId')` — префиксное совпадение. Cookie с именем
   `adminSessionIdBackup` или `adminSessionIdOld` будет ошибочно принята за сессионную
   (и, если она стоит раньше в строке, полностью перекроет настоящую).
2. Имя cookie захардкожено строкой, хотя рядом в этом же файле импортируется
   `ADMIN_SESSION_COOKIE_NAME` (строка 12) и используется в HTTP-ветке. Переименование
   константы тихо сломает только WebSocket.
3. `split('; ')` предполагает пробел после точки с запятой, а `split('=')[1]` теряет всё
   после второго `=` и не делает `decodeURIComponent`.

**Фикс:** использовать нормальный парсер (пакет `cookie` уже есть транзитивно через `cookie-parser`):

```ts
import { parse as parseCookies } from 'cookie';

const cookies = parseCookies(cookieString);
return cookies[ADMIN_SESSION_COOKIE_NAME] ?? null;
```

**Тест:** unit-тест guard'а на WS-ветку — сейчас она покрыта только «happy path» и
«без cookie вообще» (`admin-posts-subscriptions.e2e-spec.ts`).

---

## 5. 🟡 Средняя важность

### [ ] M1. Сессия продлевается записью в БД на каждом запросе

**Файл:** `api/guards/admin-gql-auth.guard.ts:51-56`

Каждый защищённый запрос = `SELECT` + `UPDATE` в `admin_sessions`. `UPDATE` ещё и триггерит
`@updatedAt`. Для списка с автообновлением это заметная лишняя нагрузка на запись.

**Фикс:** продлевать, только если истекает менее чем через половину TTL.

```ts
const halfTtlMs = (adminSettings.sessionMaxAgeHours * 60 * 60 * 1000) / 2;

if (session.expiresAt.getTime() - Date.now() < halfTtlMs) {
  await this.adminSessionsRepository.extendExpiresAt(sessionId, expiresAt);
}
```

### [ ] M2. Статус бана нельзя получить, хотя фильтр по нему есть

**Файлы:** `api/models/admin-user-list-item.model.ts`, `api/models/admin-user-details.model.ts`

В `AdminUsersQueryInput` есть `banStatusFilter`, в БД есть `isBanned` / `banReason` / `bannedAt`,
но **ни одна модель ответа их не отдаёт**. Админка может отфильтровать забаненных, но не может
показать в таблице, кто забанен и за что, и не может показать причину в карточке пользователя.
Это делает раздел «Пользователи» функционально неполным.

**Фикс:** добавить `isBanned: Boolean!`, `banReason: String`, `bannedAt: DateTime`
в `AdminUserDetailsModel` (и как минимум `isBanned` в `AdminUserListItemModel`),
дополнить `select` в `admin-users.query-repository.ts:39-49` и `84-94`, обновить
`docs/admin-graphql.md`.

### [ ] M3. Нет аудита действий администратора

Ban / unban / delete пользователя не записываются никуда, кроме полей самого пользователя
(`banReason`, `bannedAt`, которые затираются при `unban`). Нельзя ответить на вопросы
«кто и когда удалил пользователя», «сколько раз его банили», «за что был снят предыдущий бан».

Для админ-панели журнал действий — базовое требование (и часто регуляторное). Сейчас это
дополнительно усугубляется тем, что сессия одна на всю систему (M18): даже если позже добавить
несколько администраторов, восстановить историю задним числом будет невозможно.

**Фикс:** таблица `admin_audit_log` (`id`, `adminSessionId`, `action`, `targetType`, `targetId`,
`payload jsonb`, `createdAt`) и запись в неё внутри той же транзакции, что и само действие.

### [ ] M4. В выдачу постов попадают посты soft-deleted пользователей

**Файл:** `infrastructure/repositories/admin-posts.query-repository.ts:17-29`

`where` фильтрует `deletedAt` и `status` самого поста, но не проверяет `user.deletedAt`.
При этом `adminUsers` удалённых пользователей не показывает. Получается рассогласование:
пользователя в списке нет, а его посты в ленте постов есть.

Возможно, для админки это осознанно (модерация контента удалённых аккаунтов). Тогда это надо
зафиксировать комментарием и в документации. Если нет — добавить `user: { deletedAt: null }`.
Сейчас поведение выглядит как недосмотр, потому что нигде не объяснено.

### [ ] M5. `findPostById` не фильтрует удалённые и неопубликованные посты

**Файл:** `infrastructure/repositories/admin-posts.query-repository.ts:82-110`

Используется только в обработчике события `PostCreated` для рассылки в подписку. Между
публикацией события и чтением из БД пост может быть удалён — тогда в WS уйдёт удалённый пост.
Также нет проверки `status: PUBLISHED`, то есть корректность целиком держится на том, что
`PostCreatedEvent` публикуется исключительно для опубликованных постов.

**Фикс:** заменить `findUnique` на `findFirst` с `deletedAt: null, status: PostStatus.PUBLISHED`.
Метод при этом уже возвращает `| null`, а обработчик уже корректно логирует «не найден»
(`post-created-subscripition.event-handler.ts:28-31`) — то есть фикс бесплатный.

### [ ] M6. `profiles[0].id` без защиты от пустого массива + схема объявляет `profileId` обязательным

**Файлы:** `api/models/admin-post-list-item.model.ts:29-34`, `api/models/admin-post-owner.model.ts:8-9`

```29:34:apps/snapflow-core/src/modules/admin/api/models/admin-post-list-item.model.ts
    model.owner = AdminPostOwnerModel.mapToModel({
      userId: post.user.id,
      profileId: post.user.profiles[0].id,
      username: post.user.username,
      avatarUrl: post.user.profiles[0]?.avatarUrl,
    });
```

В соседних строках одно и то же выражение написано по-разному: `profiles[0].id` без `?.`,
`profiles[0]?.avatarUrl` с `?.`. Выборка идёт с `where: { deletedAt: null }`, то есть массив
может быть пустым — тогда `TypeError` уронит весь резолвер (и обработчик события подписки).

Сейчас профиль создаётся при регистрации, а soft-delete профилей в коде не встречается,
поэтому дефект латентный. Но он сработает в тот момент, когда появится удаление профиля, —
и сломает сразу и список постов, и подписку.

Дополнительно: `AdminPostOwnerModel.profileId` объявлен как `@Field(() => Int)` — не nullable,
хотя данные этого не гарантируют. Схема обещает больше, чем может дать.

**Фикс:** сделать `profileId` nullable (`profileId: number | null`, `@Field(() => Int, { nullable: true })`),
использовать `post.user.profiles[0]?.id ?? null`, и добавить в запрос
`orderBy: { createdAt: 'desc' }, take: 1` — как это уже сделано в
`admin-users.query-repository.ts:43-48`.

### [ ] M7. Нет вторичного ключа сортировки — пагинация нестабильна

**Файлы:** `application/dto/get-admin-users-query.params.ts:34-36`,
`infrastructure/repositories/admin-posts.query-repository.ts:54-56`

Сортировка идёт по одному полю (`username`, `createdAt`). При одинаковых значениях порядок
между запросами не определён, поэтому при листании страниц записи могут дублироваться на одной
странице и пропадать с другой. Для `createdAt` с посекундной гранулярностью и пакетной
регистрацией/публикацией это реалистичный сценарий.

**Фикс:** добавить `id` вторым критерием: `orderBy: [{ [sortBy]: direction }, { id: 'desc' }]`.

### [ ] M8. Валидация `customReason` спрятана в application-слое

**Файл:** `application/utils/resolve-ban-reason-text.ts:11-31`

Правила «`customReason` обязателен при `AnotherReason`» и «не длиннее 500 символов» реализованы
внутри use case и выбрасывают `ValidationException` уже в процессе выполнения. Клиент не видит
их ни в схеме, ни в интроспекции; форма бана на фронте вынуждена дублировать правила «на глаз».

Ограничение в 500 символов при этом дублирует `@db.VarChar(500)` из схемы Prisma
(`schema.prisma:74`) — при расхождении получим ошибку БД вместо валидации.

**Фикс:** ввести `BanUserInput` с `@ValidateIf(o => o.reason === UserBanReason.AnotherReason)`,
`@IsNotEmpty()`, `@MaxLength(500)`. Правило про длину вынести в общую константу,
переиспользуемую и в схеме, и в валидации.

### [ ] M9. `banUser` принимает плоские аргументы вместо input-типа

**Файл:** `api/resolvers/admin-users.resolver.ts:61-73`

Все остальные операции модуля используют объектный `input` (`adminLogin`, `adminUsers`,
`adminPosts`, `adminPayments`), а `banUser` — три отдельных аргумента. Добавление любого
нового параметра (срок бана, уведомлять ли пользователя) станет breaking change для схемы.
Решается вместе с M8.

### [ ] M10. Имена мутаций несогласованы с остальной схемой

`deleteUser`, `banUser`, `unbanUser` — без префикса, при том что рядом `adminLogin`,
`adminLogout`, `adminUsers`, `adminUserDetails`, `adminPayments`, `adminPosts`.
Схема админская целиком, так что коллизий нет, но читаемость и автодополнение страдают.
Переименование — breaking change, поэтому имеет смысл делать его вместе с M8/M9 одним заходом
и согласовав с фронтом.

### [ ] M11. Протухшие сессии не вычищаются

`softDeleteAllActive()` при каждом логине помечает строки удалёнными, но никогда их не удаляет.
Таблица `admin_sessions` растёт монотонно. `ScheduleModule` в приложении уже подключён
(`snapflow-core.module.ts:47`).

**Фикс:** cron-задача, физически удаляющая записи с `deletedAt` старше N дней или
`expiresAt` в прошлом.

### [ ] M12. Индексы под запросы админки отсутствуют

- Поиск идёт через `contains` + `mode: 'insensitive'` → `ILIKE '%x%'`, который не использует
  обычный btree-индекс. На `users.username` и в фильтре постов это seq scan.
- `admin_sessions` имеет индекс только по `expiresAt` (`schema.prisma:210`); запросы фильтруют
  по `deletedAt` (в `softDeleteAllActive`) — там full scan, но таблица маленькая, это не срочно.

**Фикс (когда объёмы вырастут):** `pg_trgm` + GIN-индекс на `users.username`
для быстрого `ILIKE '%...%'`.

### [ ] M13. Дублирование: `profileLink` и тип `AdminRequest`

- `profileLink` реализован дважды идентично: `admin-users.resolver.ts:85-92` и
  `admin-user-details.resolver.ts:32-39`, включая `.replace(/\/$/, '')`.
- Тип `AdminRequest` объявлен дважды: `admin-gql-auth.guard.ts:21-24` и
  `admin-auth.resolver.ts:18-20`.

**Фикс:** вынести построение ссылки в общий хелпер/сервис (или в `ApiSettings.buildProfileUrl`),
а `AdminRequest` — рядом с `AdminContextDto` в `domain/types`.

### [ ] M14. Три почти идентичных класса query-params

`GetAdminUsersQueryParams`, `GetAdminPaymentsQueryParams`, `GetAdminPostsQueryParams` повторяют
`page`/`pageSize`/`search`/`sortDirection`/`calculateSkip()`. Просится базовый
`BaseAdminQueryParams<TSortField>`.

### [ ] M15. Мёртвый код с неверным типом

**Файл:** `application/dto/get-admin-posts-query.params.ts:31-33`

```31:33:apps/snapflow-core/src/modules/admin/application/dto/get-admin-posts-query.params.ts
  getPrismaOrderBy(): Record<AdminUsersSortField, AdminSortDirection> {
    return { [this.sortBy]: this.sortDirection } as Record<AdminUsersSortField, AdminSortDirection>;
  }
```

Метод объявлен для *постов*, но типизирован через `AdminUsersSortField` (импорт `AdminUsersSortField`
в файле про посты — сам по себе красный флаг), и вдобавок нигде не вызывается: репозиторий
постов строит `orderBy` сам. Это копипаста из users-версии. Удалить.

Заметьте, что `as Record<...>` здесь глушит именно ту проверку типов, которая поймала бы C1.

### [ ] M16. Шины CQRS вызываются без дженериков — результат `any`

Во всех резолверах кроме `adminLogin` вызовы вида `this.queryBus.execute(new GetAdminUsersQuery(params))`
возвращают `any`, который молча приводится к типу возврата метода. Если репозиторий начнёт отдавать
другую форму, компилятор промолчит.

**Фикс:** `this.queryBus.execute<GetAdminUsersQuery, PaginatedAdminUsersModel>(...)` — как это уже
сделано в `internal-payments.controller.ts:19` в сервисе payments.

### [ ] M17. `AdminRole` — абстракция без реализации

`AdminRole` содержит единственное значение `SuperAdmin`, и оно жёстко присваивается в guard
(`admin-gql-auth.guard.ts:60`) без какой-либо связи с данными сессии. Ни одна проверка прав
на роль не опирается.

Это либо заготовка под RBAC (тогда нужен план и запись роли в `admin_sessions`),
либо лишняя сущность, создающая иллюзию ролевой модели. Определиться и либо довести, либо убрать.

### [ ] M18. Одна сессия на всю систему

`softDeleteAllActive()` в `admin-login.usecase.ts:36` инвалидирует **все** сессии, а не сессии
конкретного администратора (их и нет — админ один, из env). Поведение задокументировано
(`docs/admin-graphql.md:54`), поэтому это не баг. Но стоит понимать цену: два администратора
или две вкладки на разных устройствах будут бесконечно выкидывать друг друга. Если админов
станет больше одного, это придётся переделывать вместе с M3 и M17.

### [ ] M19. Throttler навешан только на логин

`AdminGqlThrottlerGuard` используется в единственном месте — `adminLogin`
(`admin-auth.resolver.ts:30`). Тяжёлые query (`adminPayments` с сортировкой по username — см. H3)
и мутации ban/delete не ограничены ничем.

Кроме того, лимиты берутся из глобального `ApiSettings` (`THROTTLE_TTL` / `THROTTLE_LIMIT`,
5 запросов / 10 сек в dev), общего с публичным REST API. Для админки логично иметь
отдельный, более строгий лимит на логин и умеренный — на остальные операции.

---

## 6. ⚪ Низкая важность (качество кода)

- [ ] **L1.** Опечатка в имени файла: `post-created-subscripition.event-handler.ts` → `subscription`.
- [ ] **L2.** Комментарии-заметки в guard: `//req : { extra: request: {..}}}` (строки 16, 22) —
  это черновик отладки, а не документация; лучше заменить на нормальное описание формы
  WS-контекста или удалить. В `admin-auth.resolver.ts:54` есть заметка `vilyamz[core]: ...`
  про декоратор для `sessionId` — фиксирую как известную заметку, действий не предпринимаю.
- [ ] **L3.** `admin.module.ts:56`: `const providers = [pubSubProvider, PostCreatedSubscriptionEventHandler]`
  соседствует с ключом `providers:` в декораторе — сбивает с толку. Переименовать в
  `eventHandlers` / `infrastructureProviders`.
- [ ] **L4.** `admin-session-cookie.service.ts:37`: `ms_per_hours` — snake_case и грамматическая
  ошибка. Вынести в константу `MS_PER_HOUR`.
- [ ] **L5.** `SubscriptionHandlerName` (`constants/subscription-handler-name.constant.ts`) —
  константа в PascalCase, тогда как соседняя `POST_CREATED_EVENT` в SCREAMING_SNAKE_CASE.
  К тому же они лежат в разных местах (`constants/` и `application/events/constants/`).
  Свести к одному стилю и одному месту.
- [ ] **L6.** Импорты вида `../../../../../../../libs/common/services/date.service` (7 уровней)
  встречаются по всему модулю. Alias `@generated/prisma-snapflow` уже настроен — стоит добавить
  такой же для `libs` в `tsconfig.json`.
- [ ] **L7.** `AdminContextDto` — это не DTO, а объект контекста запроса; и объявлен классом
  без поведения. Логичнее `type AdminContext` в `domain/types/admin-context.ts`.
- [ ] **L8.** `AdminAuthPayloadModel` и `AdminMutationResultModel` идентичны (`{ success: Boolean! }`) —
  два типа в схеме с одинаковой формой. Оставить один либо явно развести по смыслу.
- [ ] **L9.** `admin-payments-sort.mapper.ts` лежит в `infrastructure/mappers`, но принимает
  application-DTO и не зависит от инфраструктуры — по смыслу это application-слой.
- [ ] **L10.** `parseSessionId` (`admin-gql-auth.guard.ts:67`) — единственный метод в модуле
  без явного типа возврата; остальной код очень последовательно аннотирован.
- [ ] **L11.** Сгенерированная схема `admin-schema.gql` пишется прямо в `src/modules/admin/`
  (`admin-graphql.module-options.ts:40`). Артефакт сборки внутри исходников — стоит вынести
  или явно закоммитить как контракт с указанием, что файл генерируемый.
- [ ] **L12.** Документация отстала от кода: `apps/snapflow-core/docs/admin-graphql.md` не содержит
  `adminPosts`, подписку `postCreated`, `AdminPostsSortField` и связанные типы —
  а именно они добавлены последними. Документ заявлен источником истины для фронта
  (там же сказано, что в проде introspection выключен), так что расхождение блокирует фронт.

---

## 7. Тесты

**Что есть (~2725 строк e2e):**

| Файл | Строк | Покрывает |
|---|---|---|
| `05-admin-auth/admin-login.e2e-spec.ts` | 341 | логин, невалидные креды, cookie, throttling |
| `05-admin-auth/admin-logout.e2e-spec.ts` | 197 | логаут, инвалидация сессии |
| `06-admin-users/admin-users-list.e2e-spec.ts` | 198 | список, пагинация, поиск, фильтр бана |
| `06-admin-users/admin-user-details.e2e-spec.ts` | 106 | карточка, NotFound |
| `06-admin-users/admin-ban-user.e2e-spec.ts` | 498 | ban/unban, причины бана |
| `06-admin-users/admin-delete-user.e2e-spec.ts` | 89 | удаление |
| `06-admin-users/admin-payments.e2e-spec.ts` | 870 | платежи, сортировки, поиск |
| `07-admin-posts/admin-posts.e2e-spec.ts` | 261 | список, soft-delete, DRAFT, поиск, пагинация |
| `07-admin-posts/admin-posts-subscriptions.e2e-spec.ts` | 165 | WS-подписка, отказ без авторизации |

**Не покрыто (в порядке важности):**

- [ ] `adminPosts(sortBy: Username)` — не покрыто, поэтому C1 дожил до ревью.
- [ ] `pageInfo.totalCount` при активном `search` в `adminPosts` — не покрыто, отсюда C2.
- [ ] Невалидная (не-UUID) cookie → ожидается `Unauthorized`, отсюда C3.
- [ ] Граничные значения `pageSize` / `page` (H2).
- [ ] Поведение при недоступном payments-сервисе: таймаут, 500, ECONNREFUSED (H6).
- [ ] Платёж пользователя, удалённого из core, — согласованность `items` и `totalCount` (H5).
- [ ] Продление сессии (`extendExpiresAt`) и её истечение по времени.
- [ ] Доступ к подписке после `adminLogout` при живом сокете (H7).

**Unit-тестов в модуле нет ни одного** (в `messaging` в соседнем приложении практика
`*.unit-spec.ts` есть). Кандидаты, где unit-тест дешевле и точнее e2e:

- `resolveBanReasonText` — чистая функция с ветвлениями и двумя видами ошибок.
- `mapAdminPaymentsParamsToInternal` / `mapAdminPaymentsSortToInternal` — чистое отображение.
- `GetAdminPaymentsQueryHandler.sortByUsername` / `enrichPayments` — логика, которую e2e
  проверяет дорого и косвенно.
- `AdminGqlAuthGuard.parseSessionId` — особенно WS-ветка (H9).
- `AdminSessionCookieService` — расчёт `maxAge`.

---

## 8. Приоритизированный план

**Спринт 1 — стабильность (полдня-день):**

1. C1 — `orderBy` через `user: { username }` + типизация `Prisma.PostOrderByWithRelationInput`.
2. C2 — `count({ where })`.
3. C3 — проверка UUID в guard'е.
4. H2 — `@Max` на `pageSize` во всех input'ах.
5. H6 — таймаут `HttpModule` + `try/catch` в клиенте платежей.
6. Тесты на всё перечисленное.

**Спринт 2 — безопасность и корректность данных (1-2 дня):**

7. H1 — argon2-хеш пароля админа + константное сравнение (+ ключ `ADMIN_PASSWORD_HASH` в env-описаниях).
8. H9 — нормальный парсер cookie в WS-ветке.
9. H5 — согласовать `items` и `totalCount` в платежах.
10. M2 — отдать `isBanned` / `banReason` наружу.
11. M5, M6, M7 — фильтры в `findPostById`, nullable `profileId`, вторичный ключ сортировки.

**Спринт 3 — архитектура (нужно решение продукта/команды):**

12. H3 + H4 — целевое решение по сортировке и поиску платежей.
    Рекомендую денормализацию `username` в сервис payments.
13. H7 + H8 — Redis PubSub и ревалидация сессии в подписке.
14. M3 — журнал действий администратора.
15. M8 + M9 + M10 — единый `BanUserInput` и согласованный нейминг мутаций (breaking change,
    делать одним заходом с фронтом).
16. M17, M18 — определиться с ролевой моделью и мультиадминностью.

**Фон (по мере касания кода):** M1, M11-M16, весь раздел L.
Отдельно и как можно скорее — **L12**: привести `docs/admin-graphql.md` в соответствие с кодом,
поскольку в проде introspection отключён и фронт опирается только на этот документ.
