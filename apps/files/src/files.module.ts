import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { CoreModule } from './core/core.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MediaModule } from './modules/media-files/media.module';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from './modules/logger/logger.module';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';

@Module({
  imports: [CoreModule, LoggerModule, ScheduleModule.forRoot(), PrismaModule, MediaModule],
  controllers: [FilesController],
  providers: [FilesService, { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor }],
})
export class FilesModule {}
