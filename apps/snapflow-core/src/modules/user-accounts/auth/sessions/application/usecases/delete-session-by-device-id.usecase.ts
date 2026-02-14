import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { SessionContextDto } from '../../../domain/guards/dto/session-context.dto';

export class DeleteSessionByDeviceIdCommand {
  constructor(
    public readonly deviceId: string,
    public readonly dto: SessionContextDto,
  ) {}
}

@CommandHandler(DeleteSessionByDeviceIdCommand)
export class DeleteSessionByDeviceUseCase
  implements ICommandHandler<DeleteSessionByDeviceIdCommand>
{
  constructor(private readonly sessionsRepository: SessionsRepository) {}
  async execute(command: DeleteSessionByDeviceIdCommand): Promise<void> {
    const { deviceId, dto } = command;

    if (deviceId === dto.deviceId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'Cannot delete current sessiond',
      });
    }

    const session = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Session not found',
      });
    }

    if (session.userId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'Cannot delete this session',
      });
    }

    await this.sessionsRepository.softDeleteSessionById(session.id);
  }
}
