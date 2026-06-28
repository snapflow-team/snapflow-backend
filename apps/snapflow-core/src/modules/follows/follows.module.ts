import { forwardRef, Module } from '@nestjs/common';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { UsersFollowController } from './api/users-follow.controller';
import { FollowUserUseCase } from './application/usecases/follow-user.usecase';
import { UnfollowUserUseCase } from './application/usecases/unfollow-user.usecase';
import { FollowsRepository } from './infrastructure/follows-repository';
import { FollowsQueryRepository } from './infrastructure/follows.query-repository';

const useCases = [FollowUserUseCase, UnfollowUserUseCase];
const queries = [];
const repositories = [FollowsRepository, FollowsQueryRepository];

@Module({
  imports: [forwardRef(() => UserAccountsModule)],
  controllers: [UsersFollowController],
  providers: [...useCases, ...queries, ...repositories],
  exports: [FollowsQueryRepository],
})
export class FollowsModule {}
