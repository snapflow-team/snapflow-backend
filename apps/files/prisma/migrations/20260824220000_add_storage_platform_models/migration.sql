-- CreateEnum
CREATE TYPE "StorageObjectStatus" AS ENUM ('UPLOADING', 'SCANNING', 'PROCESSING', 'READY', 'FAILED', 'INFECTED');

-- CreateEnum
CREATE TYPE "StorageVariantKind" AS ENUM ('ORIGINAL', 'THUMB', 'PREVIEW', 'POSTER', 'WAVEFORM');

-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "StorageReferenceOperationType" AS ENUM ('ATTACH', 'RELEASE');

-- CreateEnum
CREATE TYPE "StorageOutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageOutboxEventType" AS ENUM ('PROCESS_OBJECT', 'DELETE_OBJECT', 'ABORT_MULTIPART');

-- CreateTable
CREATE TABLE "storage_objects" (
    "id" UUID NOT NULL,
    "owner_user_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "status" "StorageObjectStatus" NOT NULL DEFAULT 'UPLOADING',
    "sha256" TEXT,
    "byte_size" BIGINT,
    "mime_type" TEXT,
    "original_name" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "scan_status" TEXT,
    "ref_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ready_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_object_variants" (
    "id" UUID NOT NULL,
    "object_id" UUID NOT NULL,
    "kind" "StorageVariantKind" NOT NULL,
    "key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_object_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" UUID NOT NULL,
    "object_id" UUID NOT NULL,
    "owner_user_id" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "declared_size" BIGINT NOT NULL,
    "declared_mime" TEXT NOT NULL,
    "chunk_size" BIGINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "multipart_id" TEXT,
    "received_bytes" BIGINT NOT NULL DEFAULT 0,
    "parts" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_reference_operations" (
    "id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "operation" "StorageReferenceOperationType" NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "result_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_reference_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_outbox_events" (
    "id" UUID NOT NULL,
    "type" "StorageOutboxEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StorageOutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_objects_owner_user_id_profile_idx" ON "storage_objects"("owner_user_id", "profile");

-- CreateIndex
CREATE INDEX "storage_objects_status_created_at_idx" ON "storage_objects"("status", "created_at");

-- CreateIndex
CREATE INDEX "storage_objects_owner_user_id_sha256_idx" ON "storage_objects"("owner_user_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "storage_objects_owner_sha256_canonical_uidx"
ON "storage_objects"("owner_user_id", "sha256")
WHERE "deleted_at" IS NULL AND "sha256" IS NOT NULL AND "status" = 'READY';

-- CreateIndex
CREATE UNIQUE INDEX "storage_object_variants_key_key" ON "storage_object_variants"("key");

-- CreateIndex
CREATE UNIQUE INDEX "storage_object_variants_object_id_kind_key" ON "storage_object_variants"("object_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_object_id_key" ON "upload_sessions"("object_id");

-- CreateIndex
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "storage_ref_ops_idempotency_uidx" ON "storage_reference_operations"("consumer", "idempotency_key", "operation");

-- CreateIndex
CREATE INDEX "storage_outbox_events_status_created_at_idx" ON "storage_outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "storage_outbox_events_status_available_at_idx" ON "storage_outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "storage_object_variants" ADD CONSTRAINT "storage_object_variants_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "storage_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "storage_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
