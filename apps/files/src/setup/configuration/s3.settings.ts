import { IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class S3Settings {
  @IsString()
  region: string;

  @IsString()
  endpoint: string;

  @IsString()
  bucket: string;

  @IsString()
  accessKey: string;

  @IsString()
  secretKey: string;

  @IsString()
  publicBaseUrl: string;

  @IsNumber()
  presignedExpiresIn: number;

  @IsString()
  postsMediaKeyPrefix: string;

  constructor(private readonly env: EnvironmentVariable) {
    this.region = this.env.S3_REGION;
    this.endpoint = this.env.S3_ENDPOINT;
    this.bucket = this.env.S3_BUCKET;
    this.accessKey = this.env.S3_ACCESS_KEY;
    this.secretKey = this.env.S3_SECRET_KEY;
    this.publicBaseUrl = this.env.S3_PUBLIC_BASE_URL;
    this.presignedExpiresIn = Number(this.env.S3_PRESIGNED_EXPIRES_IN);
    this.postsMediaKeyPrefix = this.env.S3_POSTS_MEDIA_KEY_PREFIX;
  }

  getS3ClientConfig() {
    return {
      region: this.region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
    };
  }
}
