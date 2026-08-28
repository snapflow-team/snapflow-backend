import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { S3_CLIENT } from './object-storage.tokens';

export const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>): S3Client => {
    const s3Settings = configService.get<S3Settings>('s3Settings');

    return new S3Client(s3Settings.getS3ClientConfig());
  },
};
