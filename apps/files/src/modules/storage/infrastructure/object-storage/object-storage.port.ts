import { Readable } from 'node:stream';

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export interface CreateMultipartUploadResult {
  uploadId: string;
  key: string;
}

export interface SignedGetUrlParams {
  key: string;
  mimeType: string;
  originalName?: string | null;
  ttlSeconds: number;
}

export interface SignedGetUrlResult {
  url: string;
  expiresAt: Date;
}

export interface ObjectStoragePort {
  createMultipartUpload(key: string, mimeType: string): Promise<CreateMultipartUploadResult>;

  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer | Readable,
  ): Promise<{ etag: string }>;

  completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[]): Promise<void>;

  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  putObjectStream(key: string, body: Readable, mimeType: string): Promise<void>;

  getObjectStream(key: string): Promise<Readable>;

  headObject(key: string): Promise<{ byteSize: bigint; mimeType: string | null }>;

  deleteObject(key: string): Promise<void>;

  getSignedGetUrl(params: SignedGetUrlParams): Promise<SignedGetUrlResult>;
}
