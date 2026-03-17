import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { CoreModule } from './core/core.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MediaModule } from './modules/media-files/media.module';

@Module({
  imports: [CoreModule, PrismaModule, MediaModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
