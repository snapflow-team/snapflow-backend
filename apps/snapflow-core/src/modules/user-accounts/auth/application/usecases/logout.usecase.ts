import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { Session } from '@generated/prisma';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { LogoutUserApplicationDto } from '../dto/logout-user.application-dto';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';

export class LogoutCommand {
  constructor(public readonly dto: LogoutUserApplicationDto) {}
}

@CommandHandler(LogoutCommand)
export class LogoutUseCase implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto: { deviceId } }: LogoutCommand): Promise<void> {
    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'User is not authenticated',
      });
    }

    await this.sessionsRepository.softDeleteCurrentSession(session.id);
  }
}
