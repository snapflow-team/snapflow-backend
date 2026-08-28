import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './database/prisma.module';
import { LoggerModule } from './modules/logger/logger.module';
import { MediaModule } from './modules/media-files/media.module';
import { StorageRpcModule } from './modules/storage/storage-rpc.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [
    CoreModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    MediaModule,
    StorageRpcModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor }],
})
export class FilesRpcModule {}
