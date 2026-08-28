import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { encode } from 'blurhash';
import {
  ImageProcessingResult,
  ImageProcessorPort,
  ProcessedImageVariant,
} from './media-processor.port';

const THUMB_MAX = 256;
const PREVIEW_MAX = 1280;
const MAX_INPUT_PIXELS = 50_000_000;

@Injectable()
export class SharpImageProcessorAdapter implements ImageProcessorPort {
  async processImage(input: Buffer): Promise<ImageProcessingResult> {
    const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .withMetadata({ orientation: undefined });

    const originalBuffer = await pipeline.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const thumbBuffer = await pipeline
      .clone()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    const previewBuffer = await pipeline
      .clone()
      .resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const blurSource = await sharp(thumbBuffer).raw().ensureAlpha().toBuffer({
      resolveWithObject: true,
    });

    const blurhash = encode(
      new Uint8ClampedArray(blurSource.data),
      blurSource.info.width,
      blurSource.info.height,
      4,
      3,
    );

    const originalMeta = await sharp(originalBuffer).metadata();
    const thumbMeta = await sharp(thumbBuffer).metadata();
    const previewMeta = await sharp(previewBuffer).metadata();

    const toVariant = (
      buffer: Buffer,
      width: number | undefined,
      height: number | undefined,
    ): ProcessedImageVariant => ({
      buffer,
      mimeType: 'image/jpeg',
      byteSize: BigInt(buffer.length),
      width: width ?? 0,
      height: height ?? 0,
    });

    return {
      original: toVariant(originalBuffer, originalMeta.width, originalMeta.height),
      thumb: toVariant(thumbBuffer, thumbMeta.width, thumbMeta.height),
      preview: toVariant(previewBuffer, previewMeta.width, previewMeta.height),
      blurhash,
    };
  }
}
