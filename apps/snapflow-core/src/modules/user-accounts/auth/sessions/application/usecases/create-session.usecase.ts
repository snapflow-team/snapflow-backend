import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { Prisma } from '../../../../../../../generated/prisma';
import { parseUserAgent } from '../../../../../../../../../libs/common/utils/user-agent.parser';

export class CreateSessionCommand {
  constructor(public readonly dto: CreateSessionDto) {}
}

@CommandHandler(CreateSessionCommand)
export class CreateSessionUseCase implements ICommandHandler<CreateSessionCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async execute({
    dto: { userId, deviceId, userAgent, ip, iat, exp },
  }: CreateSessionCommand): Promise<void> {
    const deviceName: string = parseUserAgent(userAgent);

    const sessionData: Prisma.SessionCreateInput = {
      deviceId,
      deviceName,
      ip,
      iat: new Date(iat * 1000),
      exp: new Date(exp * 1000),

      user: {
        connect: {
          id: userId,
        },
      },
    };

    await this.sessionsRepository.create(sessionData);
  }
}
