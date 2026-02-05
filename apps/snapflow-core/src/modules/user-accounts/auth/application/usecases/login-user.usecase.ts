import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { LoginUserApplicationDto } from '../dto/login-user.application-dto';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../constants/auth-tokens.inject-constants';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { CreateSessionDto } from '../../sessions/dto/create-session.dto';
import { CreateSessionCommand } from '../../sessions/application/usecases/create-session.usecase';

export class LoginUserCommand {
  constructor(public readonly dto: LoginUserApplicationDto) {}
}

@CommandHandler(LoginUserCommand)
export class LoginUserUseCase implements ICommandHandler<LoginUserCommand> {
  constructor(
    @Inject(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly accessTokenContext: JwtService,

    @Inject(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly refreshTokenContext: JwtService,

    private readonly cryptoService: CryptoService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto: { userId, ip, userAgent } }: LoginUserCommand): Promise<AuthTokens> {
    const accessToken: string = this.accessTokenContext.sign({
      userId,
    });

    const deviceId: string = this.cryptoService.generateUUID();
    const refreshToken: string = this.refreshTokenContext.sign({
      userId,
      deviceId,
    });

    const { iat, exp }: PayloadRefreshToken =
      this.refreshTokenContext.decode<PayloadRefreshToken>(refreshToken);

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
