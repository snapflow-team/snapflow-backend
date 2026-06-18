import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@generated/prisma-snapflow';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';
import { BanUserByAdminApplicationDto } from '../dto/ban-user-by-admin-application.dto';
import { resolveBanReasonText } from '../utils/resolve-ban-reason-text';

export class BanUserByAdminCommand {
  constructor(public readonly dto: BanUserByAdminApplicationDto) {}
}

@CommandHandler(BanUserByAdminCommand)
export class BanUserByAdminUseCase implements ICommandHandler<BanUserByAdminCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ dto }: BanUserByAdminCommand): Promise<void> {
    const { userId, reason, customReason } = dto;
    const user: User | null = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(`The user with ID (${userId}) does not exist`);
    }

    const banReason: string = resolveBanReasonText(reason, customReason);
    const bannedAt: Date = new Date();

    await this.usersRepository.banById(userId, banReason, bannedAt);
  }
}
