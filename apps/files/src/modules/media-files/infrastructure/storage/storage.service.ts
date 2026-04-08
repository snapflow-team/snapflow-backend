import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, } from '@aws-sdk/client-s3';
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
    //TODO(vitaliy) как правильно работать с клиентом, нужно ли его создавать каждый раз?
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
  //TODO(vitaliy) rename to isObjectExists
  async objectExists(key: string): Promise<boolean> {
    try {
      //HeadObjectCommand команда «проверить, существует ли файл»
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async uploadFile(key: string, buffer: Buffer, mimetype: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read',
    });

    await this.s3.send(command);

    return this.getPublicUrl(key);
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3.send(command);
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
