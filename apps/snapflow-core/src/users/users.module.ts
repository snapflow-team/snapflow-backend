import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service';
import { UsersController } from './api/users.controller';
import { UsersRepository } from './infrastructure/users.repository';

@Module({
  imports: [],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [],
})
export class UsersModule {}
