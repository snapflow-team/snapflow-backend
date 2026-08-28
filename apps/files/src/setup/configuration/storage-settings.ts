import { IsNumber, IsString, Max, Min } from 'class-validator';
import { EnvironmentVariable } from './configuration';

const MIN_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHUNK_SIZE_BYTES = 100 * 1024 * 1024;
const MIN_SIGNED_URL_TTL_SECONDS = 60;
const MAX_SIGNED_URL_TTL_SECONDS = 3600;

export class StorageSettings {
  @IsString()
  privateBucket: string;

  @IsString()
  privateSseMode: string;

  @IsNumber()
  @Min(MIN_SIGNED_URL_TTL_SECONDS)
  @Max(MAX_SIGNED_URL_TTL_SECONDS)
  signedUrlTtlSeconds: number;

  @IsNumber()
  @Min(60)
  uploadSessionTtlSeconds: number;

  @IsNumber()
  @Min(MIN_CHUNK_SIZE_BYTES)
  @Max(MAX_CHUNK_SIZE_BYTES)
  chunkSizeBytes: number;

  @IsNumber()
  @Min(3600)
  orphanTtlSeconds: number;

  @IsNumber()
  @Min(1)
  quotaBytesPerMinute: number;

  @IsNumber()
  @Min(1)
  maxConcurrentUploads: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.privateBucket = environmentVariables.S3_PRIVATE_BUCKET;
    this.privateSseMode = environmentVariables.S3_PRIVATE_SSE_MODE;
    this.signedUrlTtlSeconds = Number(environmentVariables.STORAGE_SIGNED_URL_TTL_SECONDS);
    this.uploadSessionTtlSeconds = Number(environmentVariables.STORAGE_UPLOAD_SESSION_TTL_SECONDS);
    this.chunkSizeBytes = Number(environmentVariables.STORAGE_CHUNK_SIZE_BYTES);
    this.orphanTtlSeconds = Number(environmentVariables.STORAGE_ORPHAN_TTL_SECONDS);
    this.quotaBytesPerMinute = Number(environmentVariables.STORAGE_QUOTA_BYTES_PER_MINUTE);
    this.maxConcurrentUploads = Number(environmentVariables.STORAGE_MAX_CONCURRENT_UPLOADS);
  }
}
