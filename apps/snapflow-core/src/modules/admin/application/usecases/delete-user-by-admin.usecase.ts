import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@generated/prisma-snapflow';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';

export class DeleteUserByAdminCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(DeleteUserByAdminCommand)
export class DeleteUserByAdminUseCase implements ICommandHandler<DeleteUserByAdminCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ userId }: DeleteUserByAdminCommand): Promise<void> {
    const user: User | null = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(`The user with ID (${userId}) does not exist`);
    }

    await this.usersRepository.softDeleteById(userId);
  }
}
