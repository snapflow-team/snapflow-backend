import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { StorageObjectStatus } from '@contracts/storage';
import { StorageOutboxEventType } from '@generated/prisma-files';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvalidProfileException,
  InvalidRangeException,
  QuotaExceededException,
  StorageObject,
  StorageObjectNotFoundException,
  UnsupportedMimeTypeException,
  UploadSession,
  UploadSessionNotFoundException,
} from '../../../domain';
import { StorageProfileRegistryService } from '../../profiles/storage-profile-registry.service';
import { UploadQuotaService } from '../../services/upload-quota.service';
import { StorageObjectRepository } from '../../../infrastructure/persistence/repositories/storage-object.repository';
import { UploadSessionRepository } from '../../../infrastructure/persistence/repositories/upload-session.repository';
import { StorageOutboxRepository } from '../../../infrastructure/persistence/repositories/storage-outbox.repository';
import { OBJECT_STORAGE_PORT } from '../../../infrastructure/object-storage/object-storage.tokens';
import type { ObjectStoragePort } from '../../../infrastructure/object-storage/object-storage.port';
import { buildRawKey } from '../../../infrastructure/object-storage/storage-key.builder';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { StorageSettings } from '../../../../../setup/configuration/storage-settings';
import { StorageMetaMapper } from '../../services/storage-meta.mapper';
import { PrismaService } from '../../../../../database/prisma.service';
import { MimeSnifferService } from '../../../api/http/services/mime-sniffer.service';

export interface DirectUploadCommand {
  ownerUserId: number;
  profile: string;
  originalName?: string | null;
  declaredMime?: string | null;
  stream: Readable;
}

export interface DirectUploadResult {
  objectId: string;
  status: StorageObjectStatus;
}

@Injectable()
export class DirectUploadUseCase {
  constructor(
    private readonly profileRegistry: StorageProfileRegistryService,
    private readonly quotaService: UploadQuotaService,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    private readonly mimeSniffer: MimeSnifferService,
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    configService: ConfigService<Configuration, true>,
  ) {
    this.storageSettings = configService.get<StorageSettings>('storageSettings');
  }

  private readonly storageSettings: StorageSettings;

  async execute(command: DirectUploadCommand): Promise<DirectUploadResult> {
    const profile = this.profileRegistry.getProfile(command.profile);

    if (!profile) {
      throw new InvalidProfileException();
    }

    const { buffer, sha256, byteSize, mimeType } = await this.mimeSniffer.sniffStream(
      command.stream,
      profile.maxSizeBytes,
    );

    if (!profile.allowedMimeTypes.includes(mimeType)) {
      throw new UnsupportedMimeTypeException();
    }

    const acquired = await this.quotaService.tryAcquire({
      ownerUserId: command.ownerUserId,
      profile: command.profile,
      byteSize: Number(byteSize),
      quotaBytesPerMinute: profile.quotaBytesPerMinute,
      maxConcurrentUploads: this.storageSettings.maxConcurrentUploads,
    });

    if (!acquired) {
      throw new QuotaExceededException();
    }

    const objectId = randomUUID();
    const object = StorageObject.createUploading({
      id: objectId,
      ownerUserId: command.ownerUserId,
      profile: command.profile,
      originalName: command.originalName,
    });

    object.recordAcceptedBytes({ sha256, byteSize, mimeType });
    const rawKey = buildRawKey(objectId);

    try {
      await this.objectStorage.putObjectStream(rawKey, Readable.from(buffer), mimeType);

      await this.prisma.$transaction(async (tx) => {
        object.markScanning();
        await this.storageObjectRepository.save(object, tx);
        await this.storageOutboxRepository.createEvent(
          StorageOutboxEventType.PROCESS_OBJECT,
          { objectId },
          tx,
        );
      });
    } finally {
      await this.quotaService.releaseSession(command.ownerUserId, command.profile);
    }

    return { objectId, status: StorageObjectStatus.SCANNING };
  }
}

export interface CreateResumableUploadCommand {
  ownerUserId: number;
  profile: string;
  declaredSize: bigint;
  declaredMime: string;
  originalName?: string | null;
}

export interface CreateResumableUploadResult {
  sessionId: string;
  objectId: string;
  chunkSize: bigint;
  offset: bigint;
  expiresAt: Date;
}

@Injectable()
export class CreateResumableUploadUseCase {
  constructor(
    private readonly profileRegistry: StorageProfileRegistryService,
    private readonly quotaService: UploadQuotaService,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly uploadSessionRepository: UploadSessionRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    configService: ConfigService<Configuration, true>,
  ) {
    this.storageSettings = configService.get<StorageSettings>('storageSettings');
  }

  private readonly storageSettings: StorageSettings;

  async execute(command: CreateResumableUploadCommand): Promise<CreateResumableUploadResult> {
    const profile = this.profileRegistry.getProfile(command.profile);

    if (!profile) {
      throw new InvalidProfileException();
    }

    if (command.declaredSize <= 0n || command.declaredSize > BigInt(profile.maxSizeBytes)) {
      throw new InvalidRangeException();
    }

    if (!profile.allowedMimeTypes.includes(command.declaredMime)) {
      throw new UnsupportedMimeTypeException();
    }

    const acquired = await this.quotaService.tryAcquire({
      ownerUserId: command.ownerUserId,
      profile: command.profile,
      byteSize: Number(command.declaredSize),
      quotaBytesPerMinute: profile.quotaBytesPerMinute,
      maxConcurrentUploads: this.storageSettings.maxConcurrentUploads,
    });

    if (!acquired) {
      throw new QuotaExceededException();
    }

    const objectId = randomUUID();
    const sessionId = randomUUID();
    const rawKey = buildRawKey(objectId);
    const multipart = await this.objectStorage.createMultipartUpload(rawKey, command.declaredMime);
    const expiresAt = new Date(Date.now() + profile.uploadSessionTtlSeconds * 1000);

    const object = StorageObject.createUploading({
      id: objectId,
      ownerUserId: command.ownerUserId,
      profile: command.profile,
      originalName: command.originalName,
    });

    const session = UploadSession.create({
      id: sessionId,
      objectId,
      ownerUserId: command.ownerUserId,
      profile: command.profile,
      declaredSize: command.declaredSize,
      declaredMime: command.declaredMime,
      chunkSize: BigInt(profile.chunkSizeBytes),
      storageKey: rawKey,
      multipartId: multipart.uploadId,
      expiresAt,
    });

    await this.storageObjectRepository.save(object);
    await this.uploadSessionRepository.save({
      session,
      parts: [],
      multipartId: multipart.uploadId,
      storageKey: rawKey,
    });

    return {
      sessionId,
      objectId,
      chunkSize: BigInt(profile.chunkSizeBytes),
      offset: 0n,
      expiresAt,
    };
  }
}

@Injectable()
export class PatchResumableUploadUseCase {
  constructor(
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly quotaService: UploadQuotaService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async execute(params: {
    sessionId: string;
    ownerUserId: number;
    offset: bigint;
    body: Buffer;
  }): Promise<{ offset: bigint }> {
    const record = await this.uploadSessionRepository.findById(params.sessionId);

    if (!record) {
      throw new UploadSessionNotFoundException();
    }

    if (record.session.ownerUserId !== params.ownerUserId) {
      throw new UploadSessionNotFoundException();
    }

    const locked = await this.quotaService.acquireSessionLock(params.sessionId);

    if (!locked) {
      return { offset: record.session.receivedBytes };
    }

    try {
      if (params.offset !== record.session.receivedBytes) {
        return { offset: record.session.receivedBytes };
      }

      record.session.recordPart(params.offset, BigInt(params.body.length));
      const partNumber = record.parts.length + 1;
      const uploaded = await this.objectStorage.uploadPart(
        record.storageKey,
        record.multipartId!,
        partNumber,
        params.body,
      );

      record.parts.push({
        partNumber,
        etag: uploaded.etag,
        size: BigInt(params.body.length),
      });

      await this.uploadSessionRepository.save(record);

      return { offset: record.session.receivedBytes };
    } finally {
      await this.quotaService.releaseSessionLock(params.sessionId);
    }
  }
}

@Injectable()
export class CompleteResumableUploadUseCase {
  constructor(
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    private readonly quotaService: UploadQuotaService,
    private readonly mimeSniffer: MimeSnifferService,
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async execute(params: {
    sessionId: string;
    ownerUserId: number;
    sha256?: string;
  }): Promise<{ objectId: string; status: StorageObjectStatus }> {
    const record = await this.uploadSessionRepository.findById(params.sessionId);

    if (!record || record.session.ownerUserId !== params.ownerUserId) {
      throw new UploadSessionNotFoundException();
    }

    record.session.complete();

    await this.objectStorage.completeMultipartUpload(
      record.storageKey,
      record.multipartId!,
      record.parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
    );

    const stream = await this.objectStorage.getObjectStream(record.storageKey);
    const sniffed = await this.mimeSniffer.sniffStream(stream, Number(record.session.declaredSize));

    const object = await this.storageObjectRepository.findById(record.session.objectId);

    if (!object) {
      throw new StorageObjectNotFoundException();
    }

    object.recordAcceptedBytes({
      sha256: params.sha256 ?? sniffed.sha256,
      byteSize: sniffed.byteSize,
      mimeType: sniffed.mimeType,
    });

    await this.prisma.$transaction(async (tx) => {
      object.markScanning();
      await this.storageObjectRepository.save(object, tx);
      await this.uploadSessionRepository.save(record, tx);
      await this.storageOutboxRepository.createEvent(
        StorageOutboxEventType.PROCESS_OBJECT,
        { objectId: object.id },
        tx,
      );
    });

    await this.quotaService.releaseSession(params.ownerUserId, record.session.profile);

    return { objectId: object.id, status: StorageObjectStatus.SCANNING };
  }
}

@Injectable()
export class AbortResumableUploadUseCase {
  constructor(
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    private readonly quotaService: UploadQuotaService,
  ) {}

  async execute(params: { sessionId: string; ownerUserId: number }): Promise<void> {
    const record = await this.uploadSessionRepository.findById(params.sessionId);

    if (!record || record.session.ownerUserId !== params.ownerUserId) {
      return;
    }

    record.session.abort();

    if (record.multipartId) {
      await this.storageOutboxRepository.createEvent(StorageOutboxEventType.ABORT_MULTIPART, {
        sessionId: record.session.id,
        key: record.storageKey,
        uploadId: record.multipartId,
      });
    }

    await this.storageObjectRepository.deleteById(record.session.objectId);
    await this.uploadSessionRepository.deleteById(record.session.id);
    await this.quotaService.releaseSession(params.ownerUserId, record.session.profile);
  }
}

@Injectable()
export class GetObjectStatusUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly metaMapper: StorageMetaMapper,
  ) {}

  async execute(params: { objectId: string; ownerUserId: number }) {
    const row = await this.storageObjectRepository.findByIdWithVariants(params.objectId);

    if (!row || row.ownerUserId !== params.ownerUserId) {
      throw new StorageObjectNotFoundException();
    }

    return this.metaMapper.toObjectMeta(row);
  }
}

@Injectable()
export class GetUploadSessionUseCase {
  constructor(private readonly uploadSessionRepository: UploadSessionRepository) {}

  async execute(params: { sessionId: string; ownerUserId: number }): Promise<{ offset: bigint }> {
    const record = await this.uploadSessionRepository.findById(params.sessionId);

    if (!record || record.session.ownerUserId !== params.ownerUserId) {
      throw new UploadSessionNotFoundException();
    }

    return { offset: record.session.receivedBytes };
  }
}
