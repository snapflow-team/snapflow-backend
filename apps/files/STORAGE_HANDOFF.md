# Storage Platform Handoff (Э0–Э2)

## Migration

Создана миграция (create-only, не применена):

`apps/files/prisma/migrations/20260824220000_add_storage_platform_models/migration.sql`

**Применить в нужном окружении:**

```bash
# development
pnpm prisma:deploy:dev:files

# testing
pnpm prisma:deploy:test:files

# production
pnpm prisma:deploy:prod:files
```

После deploy — убедиться, что partial unique index `storage_objects_owner_sha256_canonical_uidx` создан.

## Entrypoints

| Процесс | Команда dev | Команда prod |
|---------|-------------|--------------|
| RPC (legacy + storage.v1) | `pnpm start:dev:files:rpc` | `pnpm start:prod:files` |
| HTTP ingest | `pnpm start:dev:files:ingest` | `pnpm start:prod:files:ingest` |
| Worker | `pnpm start:dev:files:worker` | `pnpm start:prod:files:worker` |
| All-in-one (local) | `pnpm start:dev:files` | `pnpm start:prod:files:local` |

## DevOps prerequisites

### S3
- Bucket: `S3_PRIVATE_BUCKET` (private, no public-read)
- SSE: `S3_PRIVATE_SSE_MODE` (например `AES256`)
- Lifecycle rule: `AbortIncompleteMultipartUpload` (7 days recommended)

### Redis
- `REDIS_URL` для BullMQ и upload quotas

### ClamAV
- `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`
- Production: `CLAMAV_DEGRADATION_MODE=strict` (noop запрещён)

### Worker
- `FFMPEG_PATH`, `FFPROBE_PATH`, `STORAGE_WORKER_TEMP_DIR`
- ffmpeg установлен в Docker image (`apps/files/Dockerfile`)

### Ingest
- `STORAGE_INGEST_PORT`, `STORAGE_INGEST_PUBLIC_HOST`, `STORAGE_INGEST_ALLOWED_ORIGINS`
- `JWT_SECRET_AT` для Bearer auth
- Ingress с увеличенным upload timeout

### Deployment manifests
- RPC: `apps/files/deployment.yaml` (существующий)
- Ingest: `apps/files/deployment-ingest.yaml`
- Worker: `apps/files/deployment-worker.yaml`

## HTTP API (ingest)

Prefix: `api/v1/storage`

- `POST /uploads/direct` — streaming multipart upload
- `POST /uploads` — init resumable session
- `HEAD/PATCH/DELETE /uploads/:sessionId` — TUS-compatible offset upload
- `POST /uploads/:sessionId/complete` — finalize + enqueue processing
- `GET /objects/:objectId/status` — owner-only status/metadata

Auth: `Authorization: Bearer <access_token>`

## RPC API (storage.v1)

Commands: `ValidateObjects`, `AttachObjects`, `ReleaseObjects`, `GetObjectsMeta`, `GetSignedUrls`

Contracts: `libs/contracts/storage`

Client timeout: **5 seconds** (`STORAGE_RPC_TIMEOUT_MS`)

## Alerts (recommended)

- Stalled objects in `SCANNING`/`PROCESSING` > 15 min
- BullMQ queue lag > 100 jobs
- ClamAV unreachable in production
- Ingest p95 latency degradation vs RPC baseline

## Targeted checks performed

```bash
pnpm build:files:all     # ✅ all 4 entrypoints compile
pnpm test:unit:files     # ✅ domain + S3 adapter unit tests
```

## Not applied by agent

- Database migration deploy (developer responsibility)
- Production secrets / env values
- K8s ingress/TLS configuration
- ClamAV sidecar/service deployment
