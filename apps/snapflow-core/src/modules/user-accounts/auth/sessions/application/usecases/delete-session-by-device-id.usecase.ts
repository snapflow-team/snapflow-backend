import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { DomainException } from '../../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { SessionContextDto } from '../../../domain/guards/dto/session-context.dto';
import { Session } from '@generated/prisma';

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
        code: DomainExceptionCode.BadRequest,
        message: 'Cannot terminate the active session you are currently using. Use logout instead.',
        // «Нельзя завершить текущую сессию через этот запрос. Используйте выход из аккаунта.»
      });
    }

    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'The specified device session could not be found.',
      });
    }

    if (session.userId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'Access denied. You can only manage your own device sessions.',
        // «Доступ запрещен. Вы можете управлять только своими активными устройствами.»
      });
    }

    await this.sessionsRepository.softDeleteSessionById(session.id);
  }
}
