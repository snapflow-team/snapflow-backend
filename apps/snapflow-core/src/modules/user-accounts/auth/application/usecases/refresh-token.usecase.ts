import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthTokenService } from '../../../../../../../../libs/common/services/auth-token.service';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { Prisma, Session } from '@generated/prisma';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { AuthTokens } from '../../domain/types/auth-tokens.type';

export class RefreshTokenCommand {
  constructor(public readonly session: SessionContextDto) {}
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenUseCase implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokens> {
    const { userId, deviceId } = command.session;

    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session || session.userId !== userId) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Unauthorized',
      });
    }

    const accessToken = this.authTokenService.generateAccessToken(userId);
    const refreshToken = this.authTokenService.generateRefreshToken(userId, deviceId);
    const { iat, exp }: PayloadRefreshToken =
      this.authTokenService.decodeRefreshToken(refreshToken);

    const sessionData: Prisma.SessionUpdateInput = {
      iat: new Date(iat * 1000),
      exp: new Date(exp * 1000),
    };

    await this.sessionsRepository.updateSession(session.id, sessionData);

    return { accessToken, refreshToken };
  }
}
