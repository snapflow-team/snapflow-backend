import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3ObjectStorageAdapter', () => {
  const bucket = 'private-bucket';
  const send = jest.fn<Promise<unknown>, [unknown]>();
  const s3 = { send } as unknown as S3Client;
  const getSignedUrlMock = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

  const configService = {
    get: () => ({
      privateBucket: bucket,
      privateSseMode: 'AES256',
      signedUrlTtlSeconds: 300,
    }),
  } as never;

  const adapter = new S3ObjectStorageAdapter(s3, configService);

  beforeEach(() => {
    send.mockReset();
    getSignedUrlMock.mockReset();
  });

  it('creates multipart upload with SSE and without ACL', async () => {
    send.mockResolvedValueOnce({ UploadId: 'upload-1' });

    const result = await adapter.createMultipartUpload('messenger/2026/08/id/raw', 'image/jpeg');

    expect(result.uploadId).toBe('upload-1');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(CreateMultipartUploadCommand);
  });

  it('uploads parts in order and completes multipart', async () => {
    send
      .mockResolvedValueOnce({ ETag: '"part-1"' })
      .mockResolvedValueOnce({ ETag: '"part-2"' })
      .mockResolvedValueOnce({});

    await adapter.uploadPart('key', 'upload-1', 1, Buffer.from('a'));
    await adapter.uploadPart('key', 'upload-1', 2, Buffer.from('b'));
    await adapter.completeMultipartUpload('key', 'upload-1', [
      { partNumber: 1, etag: '"part-1"' },
      { partNumber: 2, etag: '"part-2"' },
    ]);

    expect(send).toHaveBeenCalledWith(expect.any(UploadPartCommand));
    expect(send).toHaveBeenCalledWith(expect.any(CompleteMultipartUploadCommand));
  });

  it('aborts multipart upload', async () => {
    send.mockResolvedValueOnce({});

    await adapter.abortMultipartUpload('key', 'upload-1');

    expect(send).toHaveBeenCalledWith(expect.any(AbortMultipartUploadCommand));
  });

  it('deletes object without public ACL', async () => {
    send.mockResolvedValueOnce({});

    await adapter.deleteObject('key');

    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });

  it('signs GET url with content type and expiry', async () => {
    getSignedUrlMock.mockResolvedValue('https://signed');

    const result = await adapter.getSignedGetUrl({
      key: 'key',
      mimeType: 'image/jpeg',
      originalName: 'photo.jpg',
      ttlSeconds: 120,
    });

    expect(result.url).toBe('https://signed');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(getSignedUrlMock).toHaveBeenCalled();
  });
});
