import { Module } from '@nestjs/common';
import { AdminSchemaPlaceholderResolver } from './api/resolvers/admin-schema-placeholder.resolver';

@Module({
  providers: [AdminSchemaPlaceholderResolver],
})
export class AdminModule {}
