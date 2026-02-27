import { Module } from '@nestjs/common';
import { FilesController } from './api/files.controller';
import { FilesService } from './infrastructure/services/files.service';
import { filesConfigDynamicModule } from './files-config-dynamic-module';
import { FilesConfig } from './files.config';
import { PrismaModule } from './database/prisma.module';
import { StorageService } from './infrastructure/services/storage.service';
import { FilesRepository } from './infrastructure/repository/files.repository';
import { JwtStrategy } from './infrastructure/services/jwt.strategy';

@Module({
  imports: [filesConfigDynamicModule, PrismaModule],
  controllers: [FilesController],
  providers: [FilesService, FilesConfig, StorageService, FilesRepository, JwtStrategy],
})
export class FilesModule {}
