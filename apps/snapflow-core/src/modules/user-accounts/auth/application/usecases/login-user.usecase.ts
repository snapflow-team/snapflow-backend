import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { LoginUserApplicationDto } from '../dto/login-user.application-dto';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { CreateSessionDto } from '../../sessions/dto/create-session.dto';
import { CreateSessionCommand } from '../../sessions/application/usecases/create-session.usecase';
import { AuthTokenService } from '../../../../../../../../libs/common/services/auth-token.service';

export class LoginUserCommand {
  constructor(public readonly dto: LoginUserApplicationDto) {}
}

@CommandHandler(LoginUserCommand)
export class LoginUserUseCase implements ICommandHandler<LoginUserCommand> {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly cryptoService: CryptoService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto: { userId, ip, userAgent } }: LoginUserCommand): Promise<AuthTokens> {
    // todo: перенести проверку кредов сюда!!!

    const accessToken: string = this.authTokenService.generateAccessToken(userId);

    const deviceId: string = this.cryptoService.generateUUID();
    const refreshToken: string = this.authTokenService.generateRefreshToken(userId, deviceId);

    const { iat, exp }: PayloadRefreshToken =
      this.authTokenService.decodeRefreshToken(refreshToken);

    const createSessionDto: CreateSessionDto = {
      userId,
      deviceId,
      userAgent,
      ip,
      iat,
      exp,
    };

    await this.commandBus.execute(new CreateSessionCommand(createSessionDto));

    return {
      accessToken,
      refreshToken,
    };
  }
}
