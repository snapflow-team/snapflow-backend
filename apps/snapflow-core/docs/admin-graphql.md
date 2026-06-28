# Admin GraphQL API — гайд для фронтенда

Документ описывает, как фронтенд admin-панели работает с GraphQL-эндпоинтом сервиса `snapflow-core`: подключение, аутентификация, доступные операции, пагинация и контракт ошибок.

> GraphQL в системе используется **только для admin-панели**. Публичный API (`/api/v1/...`) — это отдельный REST со своим Swagger и к admin GraphQL отношения не имеет.

---

## 1. Эндпоинт и подключение

| Что | Значение |
|-----|----------|
| URL | `POST <core-base-url>/admin/graphql` |
| Транспорт | стандартный GraphQL over HTTP (Apollo Server на NestJS) |
| Аутентификация | cookie-сессия admin (`adminSessionId`, `httpOnly`) |
| Cookies | запросы слать с `credentials: 'include'` |
| Playground / introspection | включены **только** в dev и staging |

В проде Playground и introspection выключены (`introspection: false`), поэтому смотреть схему «вживую» можно только на dev/staging-стенде. Источник истины по схеме — этот документ и `apps/snapflow-core/src/modules/admin/admin-schema.gql`.

### Apollo Client (рекомендуемая настройка)

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';

const httpLink = createHttpLink({
  uri: `${CORE_BASE_URL}/admin/graphql`,
  credentials: 'include', // обязательно: иначе cookie adminSessionId не уйдёт
});

export const adminApolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
```

> `credentials: 'include'` критичен для всех операций, кроме `adminLogin`: без него сессионная cookie не отправится и сервер вернёт `Unauthorized`.

---

## 2. Аутентификация

Аутентификация построена на **серверной сессии в cookie**, а не на токенах в теле ответа.

### Как это работает

1. Фронт вызывает мутацию `adminLogin(input)` с email/паролем.
2. При успехе бэкенд ставит `httpOnly` cookie `adminSessionId` (`Set-Cookie` в ответе) и возвращает `{ success: true }`. **Токен в теле не приходит** — он лежит в cookie, и фронт его не читает.
3. Все защищённые операции проходят через `AdminGqlAuthGuard`, который валидирует cookie-сессию и продлевает её срок жизни на каждом запросе.
4. `adminLogout` инвалидирует сессию на бэке и чистит cookie.

Срок жизни сессии задаётся на бэкенде (`ADMIN_SESSION_MAX_AGE_HOURS`) и **продлевается автоматически** при каждом успешном защищённом запросе.

> Важно: при `adminLogin` старые активные сессии админа инвалидируются (single-session). Параллельный логин в другой вкладке/устройстве разлогинит предыдущую сессию.

### Защищённые vs публичные операции

| Операция | Тип | Требует сессию |
|----------|-----|----------------|
| `adminLogin` | mutation | нет (есть rate-limit) |
| `adminLogout` | mutation | да |
| `adminUsers` | query | да |
| `adminUserDetails` | query | да |
| `adminPayments` | query | да |
| `deleteUser` | mutation | да |
| `banUser` | mutation | да |
| `unbanUser` | mutation | да |

Любая защищённая операция без валидной cookie вернёт ошибку с `extensions.code === 'Unauthorized'` — это сигнал «разлогинить и редиректнуть на login».

### Rate limit на логин

`adminLogin` защищён троттлингом (`AdminGqlThrottlerGuard`). При превышении лимита попыток сервер вернёт ошибку троттлинга — на фронте стоит показать «слишком много попыток, попробуйте позже».

---

## 3. Полная схема

### Queries

```graphql
type Query {
  adminUsers(input: AdminUsersQueryInput): PaginatedAdminUsersModel!
  adminUserDetails(userId: Int!): AdminUserDetailsModel!
  adminPayments(input: AdminPaymentsQueryInput): PaginatedAdminPaymentsModel!
}
```

### Mutations

```graphql
type Mutation {
  adminLogin(input: AdminLoginInput!): AdminAuthPayloadModel!
  adminLogout: AdminAuthPayloadModel!
  deleteUser(userId: Int!): AdminMutationResultModel!
  banUser(userId: Int!, reason: UserBanReason!, customReason: String): AdminMutationResultModel!
  unbanUser(userId: Int!): AdminMutationResultModel!
}
```

### Типы ответов

```graphql
type AdminAuthPayloadModel {
  success: Boolean!
}

type AdminMutationResultModel {
  success: Boolean!
}

type AdminUserListItemModel {
  id: Int!
  username: String!
  createdAt: DateTime!
  profileLink: String   # вычисляемое поле, может быть null
}

type AdminUserDetailsModel {
  id: Int!
  username: String!
  avatarUrl: String
  createdAt: DateTime!
  profileLink: String   # вычисляемое поле, может быть null
}

type AdminPaymentModel {
  userId: Int!
  username: String!
  avatarUrl: String
  date: String!
  amount: Int!
  subscriptionType: String!
  provider: String!
}

type PageInfoModel {
  page: Int!
  pageSize: Int!
  totalCount: Int!
  pagesCount: Int!
}

type PaginatedAdminUsersModel {
  items: [AdminUserListItemModel!]!
  pageInfo: PageInfoModel!
}

type PaginatedAdminPaymentsModel {
  items: [AdminPaymentModel!]!
  pageInfo: PageInfoModel!
}
```

### Inputs

```graphql
input AdminLoginInput {
  email: String!     # валидируется как email
  password: String!  # не пустой
}

input AdminUsersQueryInput {
  page: Int! = 1
  pageSize: Int! = 8
  search: String
  sortBy: AdminUsersSortField = CreatedAt
  sortDirection: AdminSortDirection = Descending
  banStatusFilter: AdminUsersBanStatusFilter = NotSelected
}

input AdminPaymentsQueryInput {
  page: Int! = 1
  pageSize: Int! = 6
  search: String
  sortBy: AdminPaymentsSortField = Date
  sortDirection: AdminSortDirection = Descending
}
```

### Enums

```graphql
enum AdminSortDirection {
  Ascending
  Descending
}

enum AdminUsersSortField {
  Username
  CreatedAt
}

enum AdminUsersBanStatusFilter {
  NotSelected
  Blocked
  NotBlocked
}

enum AdminPaymentsSortField {
  Username
  Date
  Amount
  Provider
}

enum UserBanReason {
  BadBehavior
  AdvertisingPlacement
  AnotherReason
}

# Скаляр: ISO-8601 UTC, например 2019-12-03T09:54:33Z
scalar DateTime
```

> `DateTime` (например, `createdAt`) приходит как ISO-строка UTC. Поле `date` в `AdminPaymentModel` объявлено как обычный `String!` — это тоже строка, но не скаляр `DateTime`.

---

## 4. Операции с примерами

### 4.1 adminLogin

```graphql
mutation AdminLogin($input: AdminLoginInput!) {
  adminLogin(input: $input) {
    success
  }
}
```

Variables:

```json
{ "input": { "email": "admin@example.com", "password": "secret" } }
```

После успеха бэкенд выставит cookie `adminSessionId`. Никаких токенов в `data` нет — только `{ "adminLogin": { "success": true } }`.

### 4.2 adminLogout

```graphql
mutation AdminLogout {
  adminLogout {
    success
  }
}
```

Инвалидирует серверную сессию и чистит cookie. После этого защищённые операции вернут `Unauthorized`.

### 4.3 adminUsers (список пользователей с пагинацией)

```graphql
query AdminUsers($input: AdminUsersQueryInput) {
  adminUsers(input: $input) {
    items {
      id
      username
      createdAt
      profileLink
    }
    pageInfo {
      page
      pageSize
      totalCount
      pagesCount
    }
  }
}
```

Variables (все поля input опциональны, есть дефолты):

```json
{
  "input": {
    "page": 1,
    "pageSize": 8,
    "search": "john",
    "sortBy": "CreatedAt",
    "sortDirection": "Descending",
    "banStatusFilter": "NotSelected"
  }
}
```

- `search` — поиск по пользователям (по username).
- `banStatusFilter` — `NotSelected` (все), `Blocked` (только забаненные), `NotBlocked` (только активные).
- `input` целиком можно не передавать — применятся дефолты.

### 4.4 adminUserDetails

```graphql
query AdminUserDetails($userId: Int!) {
  adminUserDetails(userId: $userId) {
    id
    username
    avatarUrl
    createdAt
    profileLink
  }
}
```

Если пользователь не найден — ошибка с `extensions.code === 'NotFound'`.

### 4.5 adminPayments

```graphql
query AdminPayments($input: AdminPaymentsQueryInput) {
  adminPayments(input: $input) {
    items {
      userId
      username
      avatarUrl
      date
      amount
      subscriptionType
      provider
    }
    pageInfo {
      page
      pageSize
      totalCount
      pagesCount
    }
  }
}
```

Variables:

```json
{
  "input": {
    "page": 1,
    "pageSize": 6,
    "search": "john",
    "sortBy": "Date",
    "sortDirection": "Descending"
  }
}
```

### 4.6 deleteUser / banUser / unbanUser

```graphql
mutation DeleteUser($userId: Int!) {
  deleteUser(userId: $userId) {
    success
  }
}

mutation BanUser($userId: Int!, $reason: UserBanReason!, $customReason: String) {
  banUser(userId: $userId, reason: $reason, customReason: $customReason) {
    success
  }
}

mutation UnbanUser($userId: Int!) {
  unbanUser(userId: $userId) {
    success
  }
}
```

- `banUser`: `reason` обязателен (enum `UserBanReason`); `customReason` опционален — текстовое уточнение причины (актуально для `AnotherReason`).
- Все три мутации возвращают `{ success: true }` при успехе. Несуществующий `userId` → `NotFound`.

---

## 5. Пагинация

Списочные query (`adminUsers`, `adminPayments`) возвращают единый shape:

```ts
type Paginated<T> = {
  items: T[];
  pageInfo: {
    page: number;        // текущая страница (1-based)
    pageSize: number;    // размер страницы
    totalCount: number;  // всего элементов
    pagesCount: number;  // всего страниц
  };
};
```

Пагинация **offset-based**: управляется `page` + `pageSize` в input. Для постранички используйте `pageInfo.pagesCount` / `pageInfo.totalCount`.

---

## 6. Контракт ошибок

GraphQL-схема (`admin-schema.gql`) описывает только успешные ответы (types, queries, mutations). **Формат ошибок в схему не входит** — это отдельное соглашение, зафиксированное здесь и в e2e-тестах бэкенда. Introspection и Playground его не показывают.

### 6.1 Общая структура HTTP-ответа

При ошибке GraphQL возвращает HTTP **200** (стандарт GraphQL) и тело с полем `errors`:

```json
{
  "errors": [
    {
      "message": "Invalid admin credentials",
      "extensions": {
        "code": "Unauthorized",
        "fields": []
      }
    }
  ],
  "data": null
}
```

| Поле | Описание |
|------|----------|
| `errors[].message` | Человекочитаемое сообщение. Для доменных ошибок — текст из бэкенда. Для невалидного input GraphQL — всегда `"Invalid input"`. |
| `errors[].extensions.code` | Машиночитаемый код ошибки. Основной ключ для ветвления на фронте. |
| `errors[].extensions.fields` | Массив ошибок по полям. Есть у доменных ошибок; у sanitized GraphQL-ошибок отсутствует. |
| `data` | `null`, если операция не выполнилась. |

В ответе **нет** `stacktrace` — бэкенд отключает его через `includeStacktraceInErrorResponses: false` и дополнительно вычищает в `formatError`.

### 6.2 Доменные ошибки (основной контракт)

Бизнес-ошибки бэкенда (`Unauthorized`, `NotFound`, `ValidationError` и т.д.) проходят через `AdminGqlExceptionsFilter` и имеют предсказуемый формат:

```typescript
type AdminGraphqlDomainErrorCode =
  | 'ValidationError'
  | 'BadRequest'
  | 'Forbidden'
  | 'NotFound'
  | 'InternalServerError'
  | 'Unauthorized';

type AdminGraphqlFieldError = {
  field: string;
  message: string;
};

type AdminGraphqlDomainErrorExtensions = {
  code: AdminGraphqlDomainErrorCode;
  fields: AdminGraphqlFieldError[];
};
```

**Неверные креденшалы (`adminLogin`):**

```json
{
  "errors": [
    {
      "message": "Invalid admin credentials",
      "extensions": { "code": "Unauthorized", "fields": [] }
    }
  ],
  "data": null
}
```

**Нет сессии / истёкшая сессия (`adminLogout`, protected queries):**

```json
{
  "errors": [
    {
      "message": "Admin is not authenticated",
      "extensions": { "code": "Unauthorized", "fields": [] }
    }
  ],
  "data": null
}
```

**Ошибки валидации input (class-validator → `ValidationException`):**

```json
{
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "ValidationError",
        "fields": [
          { "field": "email", "message": "email must be an email" }
        ]
      }
    }
  ],
  "data": null
}
```

**Сущность не найдена (`deleteUser`, `adminUserDetails`, `banUser` и т.д.):**

```json
{
  "errors": [
    {
      "message": "Not Found",
      "extensions": { "code": "NotFound", "fields": [] }
    }
  ],
  "data": null
}
```

### 6.3 Sanitized GraphQL-ошибки (невалидный синтаксис / переменные)

Если GraphQL не смог распарсить запрос или привести переменные к типам **до** выполнения резолвера, Apollo отдаёт коды `BAD_USER_INPUT` / `GRAPHQL_VALIDATION_FAILED`. Бэкенд **намеренно скрывает** сырые значения input (в т.ч. пароль) и заменяет ответ на generic:

```json
{
  "errors": [
    {
      "message": "Invalid input",
      "extensions": { "code": "BAD_USER_INPUT" }
    }
  ],
  "data": null
}
```

| Код | Когда | `fields` | Что показывать пользователю |
|-----|-------|----------|----------------------------|
| `BAD_USER_INPUT` | Неверные типы/значения переменных | нет | Generic «Некорректные данные» |
| `GRAPHQL_VALIDATION_FAILED` | Ошибка в тексте GraphQL-запроса | нет | Generic «Некорректный запрос» |

Не полагайтесь на `message` для этих кодов — он всегда `"Invalid input"`.

### 6.4 Сравнение с REST (`ErrorResponseDto`)

Admin GraphQL переиспользует **те же доменные коды**, что и REST, но форма ответа другая:

| | REST (`/api/v1/...`) | Admin GraphQL |
|--|----------------------|---------------|
| Где лежит код | `body.code` | `errors[0].extensions.code` |
| Ошибки по полям | `body.extensions[]` | `errors[0].extensions.fields[]` |
| Элемент поля | `{ field, message }` | `{ field, message }` — **тот же shape** |
| HTTP status | 4xx/5xx по коду | обычно **200** + `errors` |
| Метаданные | `timestamp`, `path`, `method` | **нет** |
| Документация | Swagger | этот файл + `admin-schema.gql` (только success) |

---

## 7. Обработка ошибок на фронте (Apollo Client)

```typescript
import { ApolloError } from '@apollo/client';

type AdminGraphqlFieldError = { field: string; message: string };

type AdminGraphqlErrorExtensions = {
  code?: string;
  fields?: AdminGraphqlFieldError[];
};

function handleAdminGraphqlError(error: ApolloError): void {
  const gqlError = error.graphQLErrors[0];
  if (!gqlError) {
    // Сетевая ошибка, 502, CORS и т.д. — отдельная ветка
    return;
  }

  const { code, fields } = (gqlError.extensions ?? {}) as AdminGraphqlErrorExtensions;

  switch (code) {
    case 'Unauthorized':
      // сессия недействительна → чистим auth-состояние, редирект на admin login
      break;

    case 'ValidationError':
      // fields → подсветка полей формы
      // fields?.forEach(({ field, message }) => setError(field, message));
      break;

    case 'NotFound':
      // toast / empty state
      break;

    case 'BAD_USER_INPUT':
    case 'GRAPHQL_VALIDATION_FAILED':
      // generic сообщение, без деталей input
      break;

    default:
      // InternalServerError и неизвестные коды
      break;
  }
}
```

Рекомендации:

1. Ветвление по **`extensions.code`**, не по `message` (кроме отображения текста пользователю).
2. Для форм используйте **`extensions.fields`**, не парсите `message`.
3. При `Unauthorized` на protected-операциях — считать сессию недействительной и чистить локальное состояние auth.
4. Запросы отправлять с **`credentials: 'include'`**, иначе cookie `adminSessionId` не уйдёт.

---

## 8. Чеклист интеграции

- [ ] Apollo Client: `uri: '<core-base-url>/admin/graphql'`, `credentials: 'include'`
- [ ] `adminLogin` → бэкенд ставит cookie `adminSessionId`; токен в теле не ждать
- [ ] Все защищённые операции уходят с cookie (`credentials: 'include'`)
- [ ] Error handler читает `error.graphQLErrors[0].extensions.code`
- [ ] Validation UI использует `extensions.fields`, не REST-поле `extensions`
- [ ] `Unauthorized` → logout / redirect на admin login
- [ ] `BAD_USER_INPUT` / `GRAPHQL_VALIDATION_FAILED` → generic UI, без показа raw input
- [ ] Rate-limit на `adminLogin` обработан (сообщение «слишком много попыток»)
- [ ] Пагинация через `page` / `pageSize`, навигация по `pageInfo`
- [ ] Не ожидать `timestamp` / `path` / `method` как в REST

---

## 9. Источники контракта на бэкенде

| Компонент | Роль |
|-----------|------|
| `admin-schema.gql` | сгенерированная GraphQL-схема (только success-ответы) |
| `admin-graphql.module-options.ts` | конфиг Apollo: path, playground/introspection, `sanitizeGraphqlError` |
| `AdminGqlExceptionsFilter` | `DomainException` → `GraphQLError` с `{ code, fields }` |
| `AdminGqlAuthGuard` | проверка cookie-сессии, продление срока, `Unauthorized` |
| `AdminGqlThrottlerGuard` | rate-limit (используется на `adminLogin`) |
| `CommonDomainExceptionCode` | enum доменных кодов (`libs/exceptions/core/domain-exception-codes.ts`) |
| резолверы | `apps/snapflow-core/src/modules/admin/api/resolvers/*` |
| e2e-тесты | `apps/snapflow-core/test/` — фиксируют контракт ошибок |
