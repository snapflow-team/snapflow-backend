import { Global, Module } from '@nestjs/common';
import { DatabaseConfig } from './database.config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DatabaseConfig],
  exports: [PrismaService],
})
export class PrismaModule {}
