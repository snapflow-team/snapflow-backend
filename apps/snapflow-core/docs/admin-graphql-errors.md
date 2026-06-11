# Admin GraphQL: формат ошибок

Документ описывает контракт ошибок для фронтенда admin-панели, работающей с GraphQL-эндпоинтом snapflow-core.

GraphQL-схема (`admin-schema.gql`) описывает только успешные ответы (types, queries, mutations). **Формат ошибок в схему не входит** — это отдельное соглашение, зафиксированное здесь и в e2e-тестах бэкенда.

## Эндпоинт

| Что | Значение |
|-----|----------|
| URL | `POST /admin/graphql` |
| Playground / introspection | только dev и staging |
| Cookies | `credentials: 'include'` — сессия admin (`adminSessionId`, httpOnly) |

Публичный REST (`/api/v1/...`) и его Swagger **не относятся** к admin GraphQL.

---

## Общая структура HTTP-ответа

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
| `data` | `null`, если операция не выполнилась. При partial errors (не используется в admin на текущем этапе) может быть частично заполнен. |

В ответе **нет** `stacktrace` — бэкенд отключает его через `includeStacktraceInErrorResponses: false` и дополнительно вычищает в `formatError`.

---

## Доменные ошибки (основной контракт)

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

### Примеры

**Неверные креденшалы (`adminLogin`):**

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

**Нет сессии / истёкшая сессия (`adminLogout`, protected queries):**

```json
{
  "errors": [
    {
      "message": "Admin is not authenticated",
      "extensions": {
        "code": "Unauthorized",
        "fields": []
      }
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

**Сущность не найдена (будущие UC: deleteUser, adminUserDetails и т.д.):**

```json
{
  "errors": [
    {
      "message": "Not Found",
      "extensions": {
        "code": "NotFound",
        "fields": []
      }
    }
  ],
  "data": null
}
```

---

## Sanitized GraphQL-ошибки (невалидный синтаксис / переменные)

Если GraphQL не смог распарсить запрос или привести переменные к типам **до** выполнения резолвера, Apollo отдаёт коды:

- `BAD_USER_INPUT`
- `GRAPHQL_VALIDATION_FAILED`

Бэкенд **намеренно скрывает** сырые значения input (в т.ч. пароль) и заменяет ответ на generic:

```json
{
  "errors": [
    {
      "message": "Invalid input",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
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

---

## Сравнение с REST (`ErrorResponseDto`)

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

## Обработка на фронте (Apollo Client)

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
      // редирект на страницу логина admin
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

## Что не покрывает GraphQL-схема

Introspection и Playground показывают:

- queries / mutations / input types;
- типы успешных ответов.

Introspection **не показывает**:

- список возможных `extensions.code`;
- shape `extensions.fields`;
- sanitized-ответы для `BAD_USER_INPUT`.

Источники контракта ошибок для фронта:

1. **Этот документ**
2. E2e-тесты admin GraphQL в `apps/snapflow-core/test/` (фаза tests в плане)
3. Исходники: `AdminGqlExceptionsFilter`, `admin-graphql.module-options.ts`

---

## Источники на бэкенде

| Компонент | Роль |
|-----------|------|
| `AdminGqlExceptionsFilter` | `DomainException` → `GraphQLError` с `{ code, fields }` |
| `sanitizeGraphqlError` в `admin-graphql.module-options.ts` | маскирует `BAD_USER_INPUT` / `GRAPHQL_VALIDATION_FAILED`, убирает `stacktrace` |
| `CommonDomainExceptionCode` | enum кодов (`libs/exceptions/core/domain-exception-codes.ts`) |

---

## Чеклист для интеграции

- [ ] Apollo Client: `uri: '<core-base-url>/admin/graphql'`, `credentials: 'include'`
- [ ] Error handler читает `error.graphQLErrors[0].extensions.code`
- [ ] Validation UI использует `extensions.fields`, не REST-поле `extensions`
- [ ] `Unauthorized` → logout / redirect на admin login
- [ ] `BAD_USER_INPUT` / `GRAPHQL_VALIDATION_FAILED` → generic UI, без показа raw input
- [ ] Не ожидать `timestamp` / `path` / `method` как в REST
