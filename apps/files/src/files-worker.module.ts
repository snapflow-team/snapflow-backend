import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './database/prisma.module';
import { LoggerModule } from './modules/logger/logger.module';
import { StorageWorkerModule } from './modules/storage/storage-worker.module';

@Module({
  imports: [CoreModule, LoggerModule, ScheduleModule.forRoot(), PrismaModule, StorageWorkerModule],
})
export class FilesWorkerModule {}
