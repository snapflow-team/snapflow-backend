# User-accounts flatten refactor — baseline invariants

Baseline captured before moving `profiles`, `sessions`, and `follows` into a flat `user-accounts` layout.
All subsequent PRs in this refactor **must** preserve the contracts and behavior listed here.

## Allowed changes

- Move files/directories to the target flat structure (`auth/`, `sessions/`, `users/`, `profiles/`, `follows/`).
- Update import paths and NestJS module `providers` / `controllers` / `exports` registration.
- Remove obsolete `forwardRef` wiring once the circular `UserAccountsModule ↔ FollowsModule` dependency is eliminated.
- Delete empty directories left after the move.

## Forbidden changes

- **HTTP routes** — controller prefixes, path params, HTTP methods, status codes, guards, and Swagger tags must stay the same.
- **DTO contracts** — input/view DTO class names, fields, validation decorators, and response shapes must not change.
- **Business logic** — use cases, query handlers, repositories, domain events, guards/strategies, and cleanup/scheduling behavior must not be refactored or "improved" in the same PRs.
- **Public API surface** — no renaming of exported classes used by other modules unless every consumer is updated atomically in the same PR (prefer keeping class names stable).
- **Database schema / Prisma** — out of scope for this refactor.

## Frozen HTTP routes (baseline)

| Prefix | Method | Path | Controller (current location) |
|--------|--------|------|-------------------------------|
| `auth` | POST | `/auth/registration` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/registration-confirmation` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/registration-email-resending` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/login` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/logout` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/password-recovery` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/check-password-recovery-code` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/new-password` | `auth/api/auth.controller.ts` |
| `auth` | GET | `/auth/me` | `auth/api/auth.controller.ts` |
| `auth` | POST | `/auth/refresh-token` | `auth/api/auth.controller.ts` |
| `oauth` | GET | `/oauth/google` | `auth/api/oauth.controller.ts` |
| `oauth` | GET | `/oauth/google/callback` | `auth/api/oauth.controller.ts` |
| `oauth` | GET | `/oauth/github` | `auth/api/oauth.controller.ts` |
| `oauth` | GET | `/oauth/github/callback` | `auth/api/oauth.controller.ts` |
| `sessions` | GET | `/sessions` | `auth/sessions/api/sessions.controller.ts` |
| `sessions` | DELETE | `/sessions/terminate-all` | `auth/sessions/api/sessions.controller.ts` |
| `sessions` | DELETE | `/sessions/:deviceId` | `auth/sessions/api/sessions.controller.ts` |
| `users` | GET | `/users/total-count` | `users/api/users.controller.ts` |
| `users` | GET | `/users/search` | `users/api/users.controller.ts` |
| `users` | POST | `/users/:userId/follow` | `follows/api/users-follow.controller.ts` |
| `users` | DELETE | `/users/:userId/follow` | `follows/api/users-follow.controller.ts` |
| `users/profile` | PUT | `/users/profile` | `users/profile/api/profile.controller.ts` |
| `users/profile` | GET | `/users/profile` | `users/profile/api/profile.controller.ts` |
| `users/profile` | GET | `/users/profile/:profileId/following` | `users/profile/api/profile.controller.ts` |
| `users/profile` | GET | `/users/profile/:profileId/followers` | `users/profile/api/profile.controller.ts` |
| `users/profile` | GET | `/users/profile/:profileId` | `users/profile/api/profile.controller.ts` |
| `users/profile` | POST | `/users/profile/avatar` | `users/profile/api/profile.controller.ts` |
| `users/profile` | DELETE | `/users/profile/avatar` | `users/profile/api/profile.controller.ts` |

## Frozen DTO locations (baseline)

Relocate with files; do not change class definitions.

### Auth input DTOs (`auth/api/input-dto/`)

- `registration-user.input-dto.ts`
- `confirmation-email-code.input-dto.ts`
- `registration-email-resending.input-dto.ts`
- `login-user.input-dto.ts`
- `password-recovery.input-dto.ts`
- `password-recovery-code.input-dto.ts`
- `new-password.input-dto.ts`

### Auth view DTOs (`auth/api/view-dto/`)

- `login.view-dto.ts`
- `me.view-dto.ts`
- `sessions.view-dto.ts` (session-specific; may move with `sessions` domain)

### Users DTOs (`users/api/dto/`)

- `input-dto/search-users.query-params.dto.ts`
- `view-dto/total-count-registered-users.view-dto.ts`
- `view-dto/search-users-page.view-dto.ts`
- `view-dto/user-search-result.view-dto.ts`

### Profile DTOs (`users/profile/api/dto/`)

- `input-dto/update-profile.input-dto.ts`
- `input-dto/profile-follow-list.query-params.dto.ts`
- `view-dto/profile.view-dto.ts`
- `view-dto/public-profile.view-dto.ts`
- `view-dto/acatar.view-dto.ts`
- `view-dto/profile-follow-list-page.view-dto.ts`
- `view-dto/profile-follow-list-item.view-dto.ts`
- `view-dto/user-metadata.view-dto.ts`

### Sessions DTOs (`auth/sessions/dto/`)

- `create-session.dto.ts`

### Follows

No public request/response DTOs — endpoints return `204 No Content`.

## Critical cross-module dependencies

These must keep working after each PR; update import paths only.

### `FollowsQueryRepository` consumers

| Consumer | Current import |
|----------|----------------|
| `posts/application/queries/get-feed.query-handler.ts` | `modules/follows/infrastructure/follows.query-repository` |
| `users/profile/.../get-public-profile.query-handler.ts` | `modules/follows/infrastructure/follows.query-repository` |
| `users/profile/.../get-profile-following.query-handler.ts` | `modules/follows/infrastructure/follows.query-repository` |
| `users/profile/.../get-profile-followers.query-handler.ts` | `modules/follows/infrastructure/follows.query-repository` |
| `users/profile/.../map-profile-follow-list-page.ts` | `modules/follows/infrastructure/follows.query-repository` |

After PR-2: `FollowsQueryRepository` must be exported from `UserAccountsModule` (replacing `FollowsModule` export).

### `UserAccountsModule` exports (baseline)

- `ProfilesRepository`
- `UsersRepository`
- `FilesClientModule`

### Auth guards / decorators used outside `user-accounts`

| Symbol | Current path | Consumers |
|--------|--------------|-----------|
| `JwtAuthGuard` | `auth/domain/guards/bearer/jwt-auth.guard` | posts, post-comments, notifications, files-media, follows |
| `JwtRefreshAuthGuard` | `auth/domain/guards/bearer/jwt-refresh-auth.guard` | auth, sessions |
| `ExtractUserFromRequest` | `auth/domain/guards/decorators/extract-user-from-request.decorator` | posts, post-comments, notifications, files-media, follows |
| `ExtractOptionalUserFromRequest` | `auth/domain/guards/decorators/extract-optional-user-from-request.decorator` | posts, post-comments, profile |
| `UserContextDto` | `auth/domain/guards/dto/user-context.dto` | posts, post-comments, notifications, files-media, follows |
| `Public` | `decorators/public.decorator` | posts, post-comments, profile |
| `OptionalAuth` | `decorators/optional-auth.decorator` | posts, post-comments, profile |
| `AuthTokenService` | `auth/application/services/auth-token.service` | notifications websocket (via `JwtAuthModule` export) |

### Other `user-accounts` imports in external modules

| Symbol | Consumers |
|--------|-----------|
| `UsersRepository` | admin (ban/unban/delete), follows use cases, payments sync |
| `ProfilesRepository` | posts `CreatePostUseCase`, e2e/int helpers |
| `UserRegisteredEvent`, `UserPasswordRecoveryEvent`, `NewSignupEvent` | notifications, nextjs integration |
| Auth input/view DTOs, `UserWithEmailConfirmation` | e2e tests and test managers |

### Module wiring (baseline)

```
SnapflowCoreModule
  ├── UserAccountsModule  ←→ forwardRef(FollowsModule)
  ├── FollowsModule       ←→ forwardRef(UserAccountsModule)
  └── PostsModule
        ├── UserAccountsModule
        └── FollowsModule   (for FollowsQueryRepository)
```

Target after PR-2: no standalone `FollowsModule`; `PostsModule` imports only `UserAccountsModule`.

### Historical debt (do not fix in refactor PRs)

`UserAccountsModule` currently registers controllers outside user domain scope: `PostsController`, `FilesMediaController`. Leave as-is unless explicitly scoped as follow-up.

## Current directory layout (baseline)

```text
modules/user-accounts/
  auth/
    sessions/          ← move to sessions/
  users/
    profile/           ← move to profiles/
  decorators/
  types/
  user-accounts.module.ts

modules/follows/       ← move into user-accounts/follows/
```

## PR review checklist

Before merging any refactor PR, verify:

- [ ] No diff in use case / repository / query handler method bodies (only imports and file paths).
- [ ] No diff in DTO field definitions or validation rules.
- [ ] No diff in controller route decorators (`@Controller`, `@Get`, `@Post`, etc.).
- [ ] `npm run build:snapflow-core` succeeds.
- [ ] Targeted e2e suites still pass (see below).

## Targeted verification commands

```bash
# Typecheck
npm run build:snapflow-core

# Auth + sessions
npx cross-env NODE_ENV=testing jest --config ./apps/snapflow-core/test/jest-e2e.json --testPathPattern="test/01-auth"

# Profiles
npx cross-env NODE_ENV=testing jest --config ./apps/snapflow-core/test/jest-e2e.json --testPathPattern="test/02-profiles"

# Follows
npx cross-env NODE_ENV=testing jest --config ./apps/snapflow-core/test/jest-e2e.json --testPathPattern="test/07-follows"

# Feed (FollowsQueryRepository)
npx cross-env NODE_ENV=testing jest --config ./apps/snapflow-core/test/jest-e2e.json --testPathPattern="test/04-posts/get-feed"

# Sessions integration tests
npx cross-env NODE_ENV=testing jest --config ./apps/snapflow-core/test/jest-int.json --testPathPattern="auth/sessions"
```
