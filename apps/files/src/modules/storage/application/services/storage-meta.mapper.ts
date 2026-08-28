import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { StorageObjectMeta, StorageObjectVariantMeta } from '@contracts/storage';
import { StorageObjectWithVariants } from '../../infrastructure/persistence/mappers/storage-object.mapper';

@Injectable()
export class StorageMetaMapper {
  toObjectMeta(row: StorageObjectWithVariants): StorageObjectMeta {
    const variants: StorageObjectVariantMeta[] = row.variants.map((variant) => ({
      kind: variant.kind as StorageObjectVariantMeta['kind'],
      mimeType: variant.mimeType,
      byteSize: Number(variant.byteSize),
      width: variant.width,
      height: variant.height,
      durationMs: variant.durationMs,
    }));

    return {
      objectId: row.id,
      ownerUserId: row.ownerUserId,
      profile: row.profile,
      status: row.status as StorageObjectMeta['status'],
      mimeType: row.mimeType,
      byteSize: row.byteSize !== null ? Number(row.byteSize) : null,
      originalName: row.originalName,
      width: row.width,
      height: row.height,
      durationMs: row.durationMs,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      variants,
    };
  }

  hashPayload(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
