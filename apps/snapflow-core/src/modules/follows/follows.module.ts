import { Module } from '@nestjs/common';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { UsersFollowController } from './api/users-follow.controller';
import { FollowsRepository } from './infrastructure/follows-repository';
import { FollowsQueryRepository } from './infrastructure/follows.query-repository';

const useCases = [];
const queries = [];
const repositories = [FollowsRepository, FollowsQueryRepository];

@Module({
  imports: [UserAccountsModule],
  controllers: [UsersFollowController],
  providers: [...useCases, ...queries, ...repositories],
  exports: [],
})
export class FollowsModule {}
