import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseConfig } from './database.config';

@Global()
@Module({
  providers: [PrismaService, DatabaseConfig],
  exports: [PrismaService],
})
export class PrismaModule {}
