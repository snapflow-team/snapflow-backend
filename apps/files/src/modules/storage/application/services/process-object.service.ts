import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ConfigService } from '@nestjs/config';
import { StorageObjectStatus, StorageVariantKind } from '@contracts/storage';
import { StorageOutboxEventType } from '@generated/prisma-files';
import { Configuration } from '../../../../setup/configuration/configuration';
import { MediaProcessingSettings } from '../../../../setup/configuration/media-processing-settings';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { StorageObject } from '../../domain';
import { STORAGE_PROFILE_IDS } from '../../application/profiles/storage-profile.types';
import {
  STORAGE_E1_DOCUMENT_MIME_TYPES,
  STORAGE_E1_IMAGE_MIME_TYPES,
  STORAGE_E2_VIDEO_MIME_TYPES,
  STORAGE_VOICE_MESSAGE_MIME_TYPES,
} from '../../application/profiles/storage-mime-whitelist';
import { StorageObjectRepository } from '../../infrastructure/persistence/repositories/storage-object.repository';
import { StorageOutboxRepository } from '../../infrastructure/persistence/repositories/storage-outbox.repository';
import { OBJECT_STORAGE_PORT } from '../../infrastructure/object-storage/object-storage.tokens';
import type { ObjectStoragePort } from '../../infrastructure/object-storage/object-storage.port';
import {
  buildRawKey,
  buildVariantKey,
} from '../../infrastructure/object-storage/storage-key.builder';
import {
  AV_PROCESSOR_PORT,
  IMAGE_PROCESSOR_PORT,
} from '../../infrastructure/processing/media-processor.port';
import type {
  AvProcessorPort,
  ImageProcessorPort,
} from '../../infrastructure/processing/media-processor.port';
import { VIRUS_SCANNER_PORT } from '../../infrastructure/scanning/virus-scanner.port';
import type { VirusScannerPort } from '../../infrastructure/scanning/virus-scanner.port';
import { Readable } from 'node:stream';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class ProcessObjectService {
  private readonly logger: ContextLogger;
  private readonly tempDir: string;

  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
    @Inject(VIRUS_SCANNER_PORT) private readonly virusScanner: VirusScannerPort,
    @Inject(IMAGE_PROCESSOR_PORT) private readonly imageProcessor: ImageProcessorPort,
    @Inject(AV_PROCESSOR_PORT) private readonly avProcessor: AvProcessorPort,
    configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(ProcessObjectService.name);
    this.tempDir =
      configService.get<MediaProcessingSettings>('mediaProcessingSettings').workerTempDir;
  }

  async execute(objectId: string): Promise<void> {
    const row = await this.storageObjectRepository.findByIdWithVariants(objectId);

    if (!row || row.deletedAt) {
      return;
    }

    if (
      row.status !== StorageObjectStatus.SCANNING &&
      row.status !== StorageObjectStatus.PROCESSING
    ) {
      return;
    }

    const object = await this.storageObjectRepository.findById(objectId);

    if (!object) {
      return;
    }

    try {
      const rawKey = buildRawKey(objectId, row.createdAt);
      const stream = await this.objectStorage.getObjectStream(rawKey);
      const verdict = await this.virusScanner.scanStream(stream);

      if (verdict === 'infected') {
        await this.handleInfected(object);
        return;
      }

      object.markProcessing();

      await this.storageObjectRepository.save(object);

      const mimeType = row.mimeType ?? 'application/octet-stream';

      if (this.isImage(mimeType)) {
        await this.processImage(object, rawKey);
      } else if (this.isDocument(mimeType)) {
        await this.processDocument(object, rawKey, mimeType);
      } else if (this.isVideo(mimeType)) {
        await this.processVideo(object, rawKey);
      } else if (this.isVoice(mimeType, row.profile)) {
        await this.processVoice(object, rawKey);
      } else {
        object.markFailed('Unsupported content type for processing');
        await this.storageObjectRepository.save(object);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(error, this.execute.name);
      object.markFailed('Processing failed');
      await this.storageObjectRepository.save(object);
      await this.storageOutboxRepository.createEvent(StorageOutboxEventType.DELETE_OBJECT, {
        objectId,
        reason: message,
      });
    }
  }

  private async handleInfected(object: StorageObject): Promise<void> {
    object.markInfected();
    await this.storageObjectRepository.save(object);
    await this.storageOutboxRepository.createEvent(StorageOutboxEventType.DELETE_OBJECT, {
      objectId: object.id,
      reason: 'infected',
    });
  }

  private async processImage(object: StorageObject, rawKey: string): Promise<void> {
    const stream = await this.objectStorage.getObjectStream(rawKey);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const input = Buffer.concat(chunks);
    const canonical = await this.tryDedup(object, input);

    if (canonical) {
      return;
    }

    const result = await this.imageProcessor.processImage(input);
    const createdAt = object.snapshot.createdAt;

    await this.objectStorage.putObjectStream(
      buildVariantKey(object.id, StorageVariantKind.ORIGINAL, createdAt),
      ReadableFromBuffer(result.original.buffer),
      result.original.mimeType,
    );
    await this.objectStorage.putObjectStream(
      buildVariantKey(object.id, StorageVariantKind.THUMB, createdAt),
      ReadableFromBuffer(result.thumb.buffer),
      result.thumb.mimeType,
    );
    await this.objectStorage.putObjectStream(
      buildVariantKey(object.id, StorageVariantKind.PREVIEW, createdAt),
      ReadableFromBuffer(result.preview.buffer),
      result.preview.mimeType,
    );

    await this.prisma.$transaction(async (tx) => {
      object.markReady({
        sha256: object.snapshot.sha256!,
        byteSize: object.snapshot.byteSize!,
        mimeType: object.snapshot.mimeType!,
        width: result.original.width,
        height: result.original.height,
        metadata: { blurhash: result.blurhash },
      });

      await this.storageObjectRepository.save(object, tx);
      await this.storageObjectRepository.saveVariants(
        [
          this.variantRecord(object.id, StorageVariantKind.ORIGINAL, result.original, createdAt),
          this.variantRecord(object.id, StorageVariantKind.THUMB, result.thumb, createdAt),
          this.variantRecord(object.id, StorageVariantKind.PREVIEW, result.preview, createdAt),
        ],
        tx,
      );
    });

    await this.objectStorage.deleteObject(rawKey);
  }

  private async processDocument(
    object: StorageObject,
    rawKey: string,
    mimeType: string,
  ): Promise<void> {
    const head = await this.objectStorage.headObject(rawKey);
    const canonical = await this.tryDedupByHash(object);

    if (canonical) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      object.markReady({
        sha256: object.snapshot.sha256!,
        byteSize: head.byteSize,
        mimeType,
      });

      await this.storageObjectRepository.save(object, tx);
      await this.storageObjectRepository.saveVariants(
        [
          {
            id: randomUUID(),
            objectId: object.id,
            kind: StorageVariantKind.ORIGINAL,
            key: rawKey,
            mimeType,
            byteSize: head.byteSize,
            width: null,
            height: null,
            durationMs: null,
          },
        ],
        tx,
      );
    });
  }

  private async processVideo(object: StorageObject, rawKey: string): Promise<void> {
    const tempInput = join(this.tempDir, `${object.id}-input`);
    const tempPreview = join(this.tempDir, `${object.id}-preview.mp4`);
    const tempPoster = join(this.tempDir, `${object.id}-poster.jpg`);

    try {
      const stream = await this.objectStorage.getObjectStream(rawKey);
      await pipeline(stream, createWriteStream(tempInput));

      const probe = await this.avProcessor.probeVideo(tempInput);
      await this.avProcessor.transcodeVideoPreview(tempInput, tempPreview);
      await this.avProcessor.extractPosterFrame(tempInput, tempPoster);

      const previewBuffer = await fs.readFile(tempPreview);
      const posterBuffer = await fs.readFile(tempPoster);
      const createdAt = object.snapshot.createdAt;

      await this.objectStorage.putObjectStream(
        buildVariantKey(object.id, StorageVariantKind.PREVIEW, createdAt),
        ReadableFromBuffer(previewBuffer),
        'video/mp4',
      );
      await this.objectStorage.putObjectStream(
        buildVariantKey(object.id, StorageVariantKind.POSTER, createdAt),
        ReadableFromBuffer(posterBuffer),
        'image/jpeg',
      );
      await this.objectStorage.putObjectStream(
        buildVariantKey(object.id, StorageVariantKind.ORIGINAL, createdAt),
        ReadableFromBuffer(await fs.readFile(tempInput)),
        object.snapshot.mimeType ?? 'video/mp4',
      );

      await this.prisma.$transaction(async (tx) => {
        object.markReady({
          sha256: object.snapshot.sha256!,
          byteSize: object.snapshot.byteSize!,
          mimeType: object.snapshot.mimeType!,
          width: probe.width,
          height: probe.height,
          durationMs: probe.durationMs,
        });

        await this.storageObjectRepository.save(object, tx);
        await this.storageObjectRepository.saveVariants(
          [
            {
              id: randomUUID(),
              objectId: object.id,
              kind: StorageVariantKind.ORIGINAL,
              key: buildVariantKey(object.id, StorageVariantKind.ORIGINAL, createdAt),
              mimeType: object.snapshot.mimeType ?? 'video/mp4',
              byteSize: object.snapshot.byteSize!,
              width: probe.width,
              height: probe.height,
              durationMs: probe.durationMs,
            },
            {
              id: randomUUID(),
              objectId: object.id,
              kind: StorageVariantKind.PREVIEW,
              key: buildVariantKey(object.id, StorageVariantKind.PREVIEW, createdAt),
              mimeType: 'video/mp4',
              byteSize: BigInt(previewBuffer.length),
              width: probe.width,
              height: probe.height,
              durationMs: probe.durationMs,
            },
            {
              id: randomUUID(),
              objectId: object.id,
              kind: StorageVariantKind.POSTER,
              key: buildVariantKey(object.id, StorageVariantKind.POSTER, createdAt),
              mimeType: 'image/jpeg',
              byteSize: BigInt(posterBuffer.length),
              width: probe.width,
              height: probe.height,
              durationMs: null,
            },
          ],
          tx,
        );
      });

      await this.objectStorage.deleteObject(rawKey);
    } finally {
      await fs.rm(tempInput, { force: true }).catch(() => undefined);
      await fs.rm(tempPreview, { force: true }).catch(() => undefined);
      await fs.rm(tempPoster, { force: true }).catch(() => undefined);
    }
  }

  private async processVoice(object: StorageObject, rawKey: string): Promise<void> {
    const tempInput = join(this.tempDir, `${object.id}-voice`);

    try {
      const stream = await this.objectStorage.getObjectStream(rawKey);
      await pipeline(stream, createWriteStream(tempInput));

      const probe = await this.avProcessor.probeAudio(tempInput);
      const waveform = await this.avProcessor.extractWaveform(tempInput, 100);
      const head = await this.objectStorage.headObject(rawKey);

      await this.prisma.$transaction(async (tx) => {
        object.markReady({
          sha256: object.snapshot.sha256!,
          byteSize: head.byteSize,
          mimeType: object.snapshot.mimeType!,
          durationMs: probe.durationMs,
          metadata: { waveform },
        });

        await this.storageObjectRepository.save(object, tx);
        await this.storageObjectRepository.saveVariants(
          [
            {
              id: randomUUID(),
              objectId: object.id,
              kind: StorageVariantKind.ORIGINAL,
              key: rawKey,
              mimeType: object.snapshot.mimeType!,
              byteSize: head.byteSize,
              width: null,
              height: null,
              durationMs: probe.durationMs,
            },
          ],
          tx,
        );
      });
    } finally {
      await fs.rm(tempInput, { force: true }).catch(() => undefined);
    }
  }

  private async tryDedup(object: StorageObject, input: Buffer): Promise<boolean> {
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(input).digest('hex');

    object.recordAcceptedBytes({
      sha256,
      byteSize: BigInt(input.length),
      mimeType: object.snapshot.mimeType!,
    });

    return this.tryDedupByHash(object);
  }

  private async tryDedupByHash(object: StorageObject): Promise<boolean> {
    const sha256 = object.snapshot.sha256;

    if (!sha256) {
      return false;
    }

    const canonical = await this.storageObjectRepository.findReadyCanonical(
      object.ownerUserId,
      sha256,
    );

    if (!canonical || canonical.id === object.id) {
      return false;
    }

    const rawKey = buildRawKey(object.id, object.snapshot.createdAt);

    await this.objectStorage.deleteObject(rawKey).catch(() => undefined);
    await this.storageObjectRepository.deleteById(object.id);

    return true;
  }

  private variantRecord(
    objectId: string,
    kind: StorageVariantKind,
    variant: { buffer: Buffer; mimeType: string; byteSize: bigint; width: number; height: number },
    createdAt: Date,
  ) {
    return {
      id: randomUUID(),
      objectId,
      kind,
      key: buildVariantKey(objectId, kind, createdAt),
      mimeType: variant.mimeType,
      byteSize: variant.byteSize,
      width: variant.width,
      height: variant.height,
      durationMs: null,
    };
  }

  private isImage(mimeType: string): boolean {
    return (STORAGE_E1_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
  }

  private isDocument(mimeType: string): boolean {
    return (STORAGE_E1_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType);
  }

  private isVideo(mimeType: string): boolean {
    return (STORAGE_E2_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType);
  }

  private isVoice(mimeType: string, profile: string): boolean {
    return (
      profile === STORAGE_PROFILE_IDS.VOICE_MESSAGE &&
      (STORAGE_VOICE_MESSAGE_MIME_TYPES as readonly string[]).includes(mimeType)
    );
  }
}

function ReadableFromBuffer(buffer: Buffer): Readable {
  return Readable.from(buffer);
}
