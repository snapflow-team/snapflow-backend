import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FollowsRepository } from '../../infrastructure/follows-repository';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';
import { User } from '@generated/prisma-snapflow';

export class FollowUserCommand {
  constructor(
    public readonly followerId: number,
    public readonly targetUserId: number,
  ) {}
}

@CommandHandler(FollowUserCommand)
export class FollowUserUseCase implements ICommandHandler<FollowUserCommand> {
  constructor(
    private readonly followsRepository: FollowsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute({ followerId, targetUserId }: FollowUserCommand): Promise<void> {
    if (followerId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser: User | null = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.isBanned) {
      throw new ForbiddenException('Cannot follow a blocked user');
    }

    await this.followsRepository.follow(followerId, targetUserId);
  }
}
