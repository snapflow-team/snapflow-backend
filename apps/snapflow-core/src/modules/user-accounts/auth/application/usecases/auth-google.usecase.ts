import { GoogleContextDto } from '../../../../../../../../libs/common/dto/google-context.dto';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { ConfirmationStatus, OAuthProvider } from '@generated/prisma';
import { CreateSessionDto } from '../../sessions/dto/create-session.dto';
import { CreateSessionCommand } from '../../sessions/application/usecases/create-session.usecase';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { AuthTokenService } from '../../../../../../../../libs/common/services/auth-token.service';

export class AuthGoogleCommand {
  constructor(
    public readonly user: GoogleContextDto,
    public readonly ip: string,
    public readonly userAgent: string,
  ) {}
}

@CommandHandler(AuthGoogleCommand)
export class AuthGoogleCommandUseCase implements ICommandHandler<AuthGoogleCommand> {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly userRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly commandBus: CommandBus,
  ) {}
  async execute(
    command: AuthGoogleCommand,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { user, ip, userAgent } = command;
    let userId: number;

    const authAccount = await this.userRepository.findAccountByProvider(
      user.providerId,
      OAuthProvider.GOOGLE,
    );

    if (authAccount) {
      // Если юзер логинился через гугл, берем ид юзера
      userId = authAccount.userId;
    } else {
      //Если акк не найден, проверяем есть ли юзер с таким емаил
      const existingUserByEmail = await this.userRepository.findUserByEmail(user.email);

      if (existingUserByEmail) {
        // Это тот же самый пользователь, просто он теперь логинится через Google
        userId = existingUserByEmail.id;

        await this.userRepository.createAccount({
          userId: userId,
          provider: OAuthProvider.GOOGLE,
          providerId: user.providerId,
          email: user.email,
        });
      } else {
        const username = await this.generateUsername(user.name || user.email);

        const createdUser = await this.userRepository.createUser({
          username,
          email: user.email,
          password: null,
          emailConfirmationCode: {
            create: {
              confirmationStatus: ConfirmationStatus.Confirmed,
            },
          },
        });

        await this.userRepository.createAccount({
          userId: createdUser.id,
          provider: OAuthProvider.GOOGLE,
          providerId: user.providerId,
          email: user.email,
        });

        userId = createdUser.id;
      }
    }

    const deviceId: string = this.cryptoService.generateUUID();
    const accessToken: string = this.authTokenService.generateAccessToken(userId);
    const refreshToken: string = this.authTokenService.generateRefreshToken(userId, deviceId);
    const payload: PayloadRefreshToken = this.authTokenService.decodeRefreshToken(refreshToken);

    const { iat, exp } = payload;

    const createSessionDto: CreateSessionDto = {
      userId,
      deviceId,
      userAgent,
      ip,
      iat,
      exp,
    };

    await this.commandBus.execute(new CreateSessionCommand(createSessionDto));
    return { accessToken, refreshToken };
  }

  private async generateUsername(base: string): Promise<string> {
    const namePart = base.split('@')[0];
    let cleanName = namePart.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

    if (cleanName.length < 6) {
      cleanName = cleanName.padEnd(6, Math.floor(Math.random() * 10).toString());
    }
    let candidate = cleanName.slice(0, 30);
    let isTaken = true;
    let attempts = 0;
    while (isTaken && attempts < 5) {
      const existingUser = await this.userRepository.findUserByUsername(candidate);
      if (!existingUser) {
        isTaken = false;
      } else {
        const suffix = `-${Math.floor(Math.random() * 1000)}`;
        candidate = cleanName.slice(0, 30 - suffix.length) + suffix;
        attempts++;
      }
    }
    return candidate;
  }
}
