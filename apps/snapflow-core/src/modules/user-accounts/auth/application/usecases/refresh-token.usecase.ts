import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthTokenService } from '../services/auth-token.service';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { UnauthorizedException } from '../../../../../common/exceptions/domain-exceptions';
import { Prisma, Session, User } from '@generated/prisma-snapflow';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { isAuthUserActive } from '../../domain/utils/assert-auth-user-active';

export class RefreshTokenCommand {
  constructor(public readonly session: SessionContextDto) {}
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenUseCase implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokens> {
    const { userId, deviceId } = command.session;

    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException();
    }

    const user: User | null = await this.usersRepository.findUserById(userId);
    if (!isAuthUserActive(user)) {
      throw new UnauthorizedException('User is not authenticated');
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
