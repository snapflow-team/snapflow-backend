import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { CoreModule } from './core/core.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [CoreModule, PrismaModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
