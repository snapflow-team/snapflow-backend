import { DynamicModule, Module } from '@nestjs/common';
import { FilesController } from './api/files.controller';
import { FilesService } from './infrastructure/services/files.service';
import { FilesConfig } from './files.config';
import { PrismaModule } from './database/prisma.module';
import { StorageService } from './infrastructure/services/storage.service';
import { FilesRepository } from './infrastructure/repository/files.repository';
import { JwtStrategy } from './infrastructure/services/jwt.strategy';
import { ApiSettings } from './setup/configuration/api-settings';
import { CoreModule } from './core/core.module';

@Module({
  imports: [CoreModule, PrismaModule],
  controllers: [FilesController],
  providers: [FilesService, FilesConfig, StorageService, FilesRepository, JwtStrategy],
})
export class FilesModule {
  static async forRoot(apiSettings: ApiSettings): Promise<DynamicModule> {
    return {
      module: FilesModule,
      imports: [],
    };
  }
}
