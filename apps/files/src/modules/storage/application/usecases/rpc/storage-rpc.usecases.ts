import { Injectable, Inject } from '@nestjs/common';
import { STORAGE_RPC_MAX_BATCH_SIZE, StorageObjectMeta } from '@contracts/storage';
import type {
  AttachObjectsRequest,
  AttachObjectsResponse,
  GetObjectsMetaRequest,
  GetObjectsMetaResponse,
  GetSignedUrlsRequest,
  GetSignedUrlsResponse,
  SignedUrl,
  ReleaseObjectsRequest,
  ReleaseObjectsResponse,
  ValidateObjectsRequest,
  ValidateObjectsResponse,
} from '@contracts/storage';
import {
  StorageReferenceOperationType,
  StorageOutboxEventType,
  Prisma,
} from '@generated/prisma-files';
import {
  InvalidProfileException,
  ObjectNotReadyException,
  OwnershipMismatchException,
  StorageObjectNotFoundException,
  assertIdempotentPayload,
} from '../../../domain';
import { StorageProfileRegistryService } from '../../profiles/storage-profile-registry.service';
import { StorageObjectRepository } from '../../../infrastructure/persistence/repositories/storage-object.repository';
import { StorageReferenceOperationRepository } from '../../../infrastructure/persistence/repositories/storage-reference-operation.repository';
import { StorageOutboxRepository } from '../../../infrastructure/persistence/repositories/storage-outbox.repository';
import { StorageMetaMapper } from '../../services/storage-meta.mapper';
import { ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE_PORT } from '../../../infrastructure/object-storage/object-storage.tokens';
import type { ObjectStoragePort } from '../../../infrastructure/object-storage/object-storage.port';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { StorageSettings } from '../../../../../setup/configuration/storage-settings';
import { PrismaService } from '../../../../../database/prisma.service';
import { RpcBadRequestException } from '../../../../../common/exceptions/rpc-domain-exceptions';

@Injectable()
export class ValidateObjectsUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly profileRegistry: StorageProfileRegistryService,
    private readonly metaMapper: StorageMetaMapper,
  ) {}

  async execute(request: ValidateObjectsRequest): Promise<ValidateObjectsResponse> {
    this.assertBatchSize(request.objectIds.length);
    this.assertProfile(request.profile);

    const rows = await this.storageObjectRepository.findManyByIdsWithVariants(request.objectIds);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const objects: StorageObjectMeta[] = [];

    for (const objectId of request.objectIds) {
      const row = byId.get(objectId);

      if (!row) {
        throw new StorageObjectNotFoundException();
      }

      if (row.ownerUserId !== request.ownerUserId) {
        throw new OwnershipMismatchException();
      }

      if (row.profile !== request.profile || row.status !== 'READY') {
        throw new ObjectNotReadyException();
      }

      objects.push(this.metaMapper.toObjectMeta(row));
    }

    return { objects };
  }

  private assertBatchSize(size: number): void {
    if (size === 0 || size > STORAGE_RPC_MAX_BATCH_SIZE) {
      throw new RpcBadRequestException('Invalid batch size');
    }
  }

  private assertProfile(profile: string): void {
    if (!this.profileRegistry.getProfile(profile)) {
      throw new InvalidProfileException();
    }
  }
}

@Injectable()
export class AttachObjectsUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly referenceOperationRepository: StorageReferenceOperationRepository,
    private readonly profileRegistry: StorageProfileRegistryService,
    private readonly metaMapper: StorageMetaMapper,
    private readonly prisma: PrismaService,
  ) {}

  async execute(request: AttachObjectsRequest): Promise<AttachObjectsResponse> {
    const payloadHash = this.metaMapper.hashPayload(request);
    const existing = await this.referenceOperationRepository.findByIdempotencyKey({
      consumer: request.consumer,
      idempotencyKey: request.idempotencyKey,
      operation: StorageReferenceOperationType.ATTACH,
    });

    if (existing) {
      assertIdempotentPayload(existing.payloadHash, payloadHash);
      return existing.resultPayload as unknown as AttachObjectsResponse;
    }

    if (!this.profileRegistry.getProfile(request.profile)) {
      throw new InvalidProfileException();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await this.storageObjectRepository.findManyByIdsWithVariants(request.objectIds);
      const byId = new Map(rows.map((row) => [row.id, row]));
      const objects: StorageObjectMeta[] = [];

      for (const objectId of request.objectIds) {
        const row = byId.get(objectId);

        if (!row) {
          throw new StorageObjectNotFoundException();
        }

        const object = await this.storageObjectRepository.findById(objectId);

        if (!object) {
          throw new StorageObjectNotFoundException();
        }

        object.assertOwnedBy(request.ownerUserId);

        if (row.profile !== request.profile || row.status !== 'READY') {
          throw new ObjectNotReadyException();
        }

        object.attach();
        await this.storageObjectRepository.save(object, tx);
        objects.push(this.metaMapper.toObjectMeta(row));
      }

      const response: AttachObjectsResponse = { objects };

      await this.referenceOperationRepository.create(
        {
          consumer: request.consumer,
          idempotencyKey: request.idempotencyKey,
          operation: StorageReferenceOperationType.ATTACH,
          payloadHash,
          requestPayload: request as unknown as Prisma.InputJsonValue,
          resultPayload: response as unknown as Prisma.InputJsonValue,
        },
        tx,
      );

      return response;
    });

    return result;
  }
}

@Injectable()
export class ReleaseObjectsUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly referenceOperationRepository: StorageReferenceOperationRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    private readonly metaMapper: StorageMetaMapper,
    private readonly prisma: PrismaService,
  ) {}

  async execute(request: ReleaseObjectsRequest): Promise<ReleaseObjectsResponse> {
    const payloadHash = this.metaMapper.hashPayload(request);
    const existing = await this.referenceOperationRepository.findByIdempotencyKey({
      consumer: request.consumer,
      idempotencyKey: request.idempotencyKey,
      operation: StorageReferenceOperationType.RELEASE,
    });

    if (existing) {
      assertIdempotentPayload(existing.payloadHash, payloadHash);
      return existing.resultPayload as unknown as ReleaseObjectsResponse;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const releasedObjectIds: string[] = [];

      for (const objectId of request.objectIds) {
        const row = await this.storageObjectRepository.findByIdWithVariants(objectId);
        const object = await this.storageObjectRepository.findById(objectId);

        if (!row || !object) {
          throw new StorageObjectNotFoundException();
        }

        object.assertOwnedBy(request.ownerUserId);
        object.release();
        await this.storageObjectRepository.save(object, tx);
        releasedObjectIds.push(objectId);

        if (object.refCount === 0) {
          await this.storageOutboxRepository.createEvent(
            StorageOutboxEventType.DELETE_OBJECT,
            { objectId, reason: 'ref_count_zero' },
            tx,
          );
        }
      }

      const response: ReleaseObjectsResponse = { releasedObjectIds };

      await this.referenceOperationRepository.create(
        {
          consumer: request.consumer,
          idempotencyKey: request.idempotencyKey,
          operation: StorageReferenceOperationType.RELEASE,
          payloadHash,
          requestPayload: request as unknown as Prisma.InputJsonValue,
          resultPayload: response as unknown as Prisma.InputJsonValue,
        },
        tx,
      );

      return response;
    });

    return result;
  }
}

@Injectable()
export class GetObjectsMetaUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly metaMapper: StorageMetaMapper,
  ) {}

  async execute(request: GetObjectsMetaRequest): Promise<GetObjectsMetaResponse> {
    const rows = await this.storageObjectRepository.findManyByIdsWithVariants(request.objectIds);

    return {
      objects: rows.map((row) => this.metaMapper.toObjectMeta(row)),
    };
  }
}

@Injectable()
export class GetSignedUrlsUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    configService: ConfigService<Configuration, true>,
  ) {
    this.signedUrlTtlSeconds =
      configService.get<StorageSettings>('storageSettings').signedUrlTtlSeconds;
  }

  private readonly signedUrlTtlSeconds: number;

  async execute(request: GetSignedUrlsRequest): Promise<GetSignedUrlsResponse> {
    const urls: SignedUrl[] = [];

    for (const item of request.items) {
      const row = await this.storageObjectRepository.findByIdWithVariants(item.objectId);

      if (!row || row.status !== 'READY') {
        throw new ObjectNotReadyException();
      }

      const variant = row.variants.find((v) => v.kind === item.variant);

      if (!variant) {
        throw new StorageObjectNotFoundException();
      }

      const signed = await this.objectStorage.getSignedGetUrl({
        key: variant.key,
        mimeType: variant.mimeType,
        originalName: row.originalName,
        ttlSeconds: this.signedUrlTtlSeconds,
      });

      urls.push({
        objectId: item.objectId,
        variant: item.variant,
        url: signed.url,
        expiresAt: signed.expiresAt.toISOString(),
      });
    }

    return { urls };
  }
}
