import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET!;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL!;

    this.s3 = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: false,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
  }

  async getPresignedPutUrl(key: string, mimeType: string, size: number): Promise<string> {
    //PutObjectCommand — команда «положить файл».
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: size,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 600 }); // 10 минут
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      //HeadObjectCommand команда «проверить, существует ли файл»
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
  getPublicUrl(key: string): string {
    const baseUrl = process.env.S3_PUBLIC_BASE_URL;

    if (baseUrl) {
      return `${baseUrl}/${key}`;
    }
    return `${this.publicBaseUrl}/${key}`;
  }
}
