import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '../../../../common/exceptions/domain-exceptions';
import { AdminSessionsRepository } from '../../infrastructure/repositories/admin-sessions.repository';
import { LogoutAdminApplicationDto } from '../dto/logout-admin-application.dto';
import { AdminSession } from '@generated/prisma-snapflow';

export class AdminLogoutCommand {
  constructor(public readonly dto: LogoutAdminApplicationDto) {}
}

@CommandHandler(AdminLogoutCommand)
export class AdminLogoutUseCase implements ICommandHandler<AdminLogoutCommand> {
  constructor(private readonly adminSessionsRepository: AdminSessionsRepository) {}

  async execute({ dto: { sessionId } }: AdminLogoutCommand): Promise<void> {
    const session: AdminSession | null =
      await this.adminSessionsRepository.findActiveById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    await this.adminSessionsRepository.softDeleteById(sessionId);
  }
}
