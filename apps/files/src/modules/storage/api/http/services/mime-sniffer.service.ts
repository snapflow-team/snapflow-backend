import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { InvalidRangeException, UnsupportedMimeTypeException } from '../../../domain';

export interface SniffResult {
  buffer: Buffer;
  sha256: string;
  byteSize: bigint;
  mimeType: string;
}

@Injectable()
export class MimeSnifferService {
  async sniffStream(stream: Readable, maxBytes: number): Promise<SniffResult> {
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let total = 0;
    let prefix: Buffer | null = null;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      hash.update(buf);
      chunks.push(buf);

      if (!prefix) {
        prefix = buf.subarray(0, Math.min(buf.length, 4100));
      }

      if (total > maxBytes) {
        throw new InvalidRangeException('Upload exceeds profile size limit');
      }
    }

    const buffer = Buffer.concat(chunks);
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = prefix ? await fileTypeFromBuffer(prefix) : undefined;
    const mimeType = detected?.mime;

    if (!mimeType) {
      throw new UnsupportedMimeTypeException('Could not detect MIME type from content');
    }

    return {
      buffer,
      sha256: hash.digest('hex'),
      byteSize: BigInt(total),
      mimeType,
    };
  }
}
