import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { Configuration } from '../../../../setup/configuration/configuration';
import { StorageSettings } from '../../../../setup/configuration/storage-settings';
import {
  CreateMultipartUploadResult,
  MultipartPart,
  ObjectStoragePort,
  SignedGetUrlParams,
  SignedGetUrlResult,
} from './object-storage.port';
import { S3_CLIENT } from './object-storage.tokens';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly bucket: string;
  private readonly sseMode: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    configService: ConfigService<Configuration, true>,
  ) {
    const storageSettings = configService.get<StorageSettings>('storageSettings');
    this.bucket = storageSettings.privateBucket;
    this.sseMode = storageSettings.privateSseMode;
  }

  async createMultipartUpload(key: string, mimeType: string): Promise<CreateMultipartUploadResult> {
    const response = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
        ...this.sseParams(),
      }),
    );

    if (!response.UploadId) {
      throw new Error('S3 did not return multipart upload id');
    }

    return { uploadId: response.UploadId, key };
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer | Readable,
  ): Promise<{ etag: string }> {
    const response = await this.s3.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );

    if (!response.ETag) {
      throw new Error('S3 did not return ETag for uploaded part');
    }

    return { etag: response.ETag };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[],
  ): Promise<void> {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            ETag: part.etag,
            PartNumber: part.partNumber,
          })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.s3.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async putObjectStream(key: string, body: Readable, mimeType: string): Promise<void> {
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ...this.sseParams(),
      },
    });

    await upload.done();
  }

  async getObjectStream(key: string): Promise<Readable> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return response.Body as Readable;
  }

  async headObject(key: string): Promise<{ byteSize: bigint; mimeType: string | null }> {
    const response = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      byteSize: BigInt(response.ContentLength ?? 0),
      mimeType: response.ContentType ?? null,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedGetUrl(params: SignedGetUrlParams): Promise<SignedGetUrlResult> {
    const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);
    const disposition = params.originalName
      ? `attachment; filename="${params.originalName.replace(/"/g, '')}"`
      : undefined;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ResponseContentType: params.mimeType,
      ...(disposition ? { ResponseContentDisposition: disposition } : {}),
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: params.ttlSeconds });

    return { url, expiresAt };
  }

  private sseParams(): Record<string, string> {
    if (this.sseMode === 'AES256') {
      return { ServerSideEncryption: 'AES256' };
    }

    if (this.sseMode.startsWith('aws:kms')) {
      return { ServerSideEncryption: 'aws:kms' };
    }

    return { ServerSideEncryption: this.sseMode };
  }
}
