import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { CoreModule } from './core/core.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MediaModule } from './modules/media-files/media.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [CoreModule, ScheduleModule.forRoot(), PrismaModule, MediaModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
