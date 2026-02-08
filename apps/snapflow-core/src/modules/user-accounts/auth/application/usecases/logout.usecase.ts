import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { Session } from '@generated/prisma';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { HttpStatus } from '@nestjs/common';

export class LogoutCommand {
  constructor(public readonly sessionContextDto: SessionContextDto) {}
}

@CommandHandler(LogoutCommand)
export class LogoutUseCase implements ICommandHandler<LogoutCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({ sessionContextDto }: LogoutCommand): Promise<void> {
    const session: Session | null = await this.sessionsRepository.findByDeviceId(
      sessionContextDto.deviceId,
    );

    if (!session) {
      throw new DomainException(
        ErrorCodes.UNAUTHORIZED,
        'User is not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.sessionsRepository.softDeleteCurrentSession(session.id);
  }
}
