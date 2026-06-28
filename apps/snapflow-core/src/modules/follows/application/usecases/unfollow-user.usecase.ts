import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FollowsRepository } from '../../infrastructure/follows-repository';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';
import {
  BadRequestException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';
import { User } from '@generated/prisma-snapflow';

export class UnfollowUserCommand {
  constructor(
    public readonly followerId: number,
    public readonly targetUserId: number,
  ) {}
}

@CommandHandler(UnfollowUserCommand)
export class UnfollowUserUseCase implements ICommandHandler<UnfollowUserCommand> {
  constructor(
    private readonly followsRepository: FollowsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute({ followerId, targetUserId }: UnfollowUserCommand): Promise<void> {
    if (followerId === targetUserId) {
      throw new BadRequestException('You cannot unfollow yourself');
    }

    const targetUser: User | null = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await this.followsRepository.unfollow(followerId, targetUserId);
  }
}
