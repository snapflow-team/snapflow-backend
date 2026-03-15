import { Injectable } from '@nestjs/common';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    this.bucket = configService.get<S3Settings>('s3Settings').bucket;
    this.publicBaseUrl = configService.get<S3Settings>('s3Settings').publicBaseUrl;

    this.s3 = new S3Client(configService.get<S3Settings>('s3Settings').getS3ClientConfig());
  }

  async getPresignedPutUrl(key: string, mimeType: string, size: number): Promise<string> {
    const expiresIn: number = this.configService.get<S3Settings>('s3Settings').presignedExpiresIn;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.s3, command, { expiresIn });
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
