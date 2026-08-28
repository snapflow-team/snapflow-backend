import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './database/prisma.module';
import { LoggerModule } from './modules/logger/logger.module';
import { StorageIngestModule } from './modules/storage/storage-ingest.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [CoreModule, LoggerModule, PrismaModule, StorageIngestModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor }],
})
export class FilesIngestModule {}
