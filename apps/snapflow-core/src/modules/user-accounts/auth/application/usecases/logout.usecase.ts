import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../../sessions/infrastructure/sessions.repository';
import { LogoutUserApplicationDto } from '../dto/logout-user.application-dto';
import { UnauthorizedException } from '../../../../../common/exceptions/domain-exceptions';
import { Session } from '@generated/prisma-snapflow';

export class LogoutCommand {
  constructor(public readonly dto: LogoutUserApplicationDto) {}
}

@CommandHandler(LogoutCommand)
export class LogoutUseCase implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ dto: { deviceId } }: LogoutCommand): Promise<void> {
    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session) {
      throw new UnauthorizedException('User is not authenticated');
    }

    await this.sessionsRepository.softDeleteSessionById(session.id);
  }
}
