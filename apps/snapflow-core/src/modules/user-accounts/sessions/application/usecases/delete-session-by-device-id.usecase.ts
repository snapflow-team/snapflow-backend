import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '../../../../../common/exceptions/domain-exceptions';
import { Session } from '@generated/prisma-snapflow';

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
      throw new BadRequestException(
        'Cannot terminate the active session you are currently using. Use logout instead',
      );
    }

    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session) {
      throw new NotFoundException('The specified device session could not be found');
    }

    if (session.userId !== dto.userId) {
      throw new ForbiddenException('Access denied. You can only manage your own device sessions');
    }

    await this.sessionsRepository.softDeleteSessionById(session.id);
  }
}
