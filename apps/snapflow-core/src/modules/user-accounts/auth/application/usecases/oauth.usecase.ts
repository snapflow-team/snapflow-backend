import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { AuthTokenService } from '../services/auth-token.service';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserUtilsService } from '../../../users/application/services/user-utils.service';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { parseUserAgentDetails } from '../../../../../../../../libs/common/utils/user-agent.parser';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { PrismaService } from '../../../../../database/prisma.service';
import { OAuthApplicationDto } from '../dto/oauth.application-dto';
import { BadRequestException } from '../../../../../common/exceptions/domain-exceptions';
import { AuthAccount, ConfirmationStatus, Prisma, User } from '@generated/prisma-snapflow';
import { NewSignupEvent } from '../../domain/events/new-signup.event';

export class OAuthCommand {
  constructor(public readonly dto: OAuthApplicationDto) {}
}

@CommandHandler(OAuthCommand)
export class OAuthUseCase implements ICommandHandler<OAuthCommand> {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly cryptoService: CryptoService,
    private readonly userUtilsService: UserUtilsService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute({
    dto: { provider, providerAccountId, email, username, ip, userAgent },
  }: OAuthCommand): Promise<AuthTokens> {
    let isNewSignup = false;

    const tokens = await this.prismaService.$transaction(async (tx) => {
      let userId: number;

      const existingAuthAccount: AuthAccount | null =
        await this.usersRepository.findAccountByProviderAccountIdAndProvider(
          providerAccountId,
          provider,
          tx,
        );

      if (existingAuthAccount) {
        userId = existingAuthAccount.userId;
      } else {
        if (!email) {
          throw new BadRequestException(`${provider} user has no email`);
        }

        const existingUser: UserWithEmailConfirmation | null =
          await this.usersRepository.findUserByEmailWithEmailConfirmation(email, tx);

        if (existingUser) {
          userId = existingUser.id;

          if (!existingUser.emailConfirmationCode) {
            await this.usersRepository.createEmailConfirmationCodeWithConfirmedStatus(
              existingUser.id,
              tx,
            );
          } else if (
            existingUser.emailConfirmationCode.confirmationStatus !== ConfirmationStatus.Confirmed
          ) {
            await this.usersRepository.confirmEmail({ userId }, tx);
          }

          await this.usersRepository.createAccount(
            {
              userId,
              provider,
              providerAccountId,
              email,
            },
            tx,
          );
        } else {
          const name: string = username || this.userUtilsService.generateUsername(email);

          const createdUser: User = await this.usersRepository.createUser(
            {
              username: name,
              email,
              password: null,
              emailConfirmationCode: {
                create: {
                  confirmationStatus: ConfirmationStatus.Confirmed,
                },
              },
            },
            tx,
          );

          await this.usersRepository.createAccount(
            {
              userId: createdUser.id,
              provider,
              providerAccountId,
              email,
            },
            tx,
          );

          userId = createdUser.id;
          isNewSignup = true;
        }
      }

      const deviceId: string = this.cryptoService.generateUUID();
      const { browserName, browserVersion, osName, osVersion, deviceName, deviceType } =
        parseUserAgentDetails(userAgent);
      const accessToken: string = this.authTokenService.generateAccessToken(userId);
      const refreshToken: string = this.authTokenService.generateRefreshToken(userId, deviceId);
      const payload: PayloadRefreshToken = this.authTokenService.decodeRefreshToken(refreshToken);

      const sessionData: Prisma.SessionCreateInput = {
        deviceId,
        deviceName,
        browserName,
        browserVersion,
        osName,
        osVersion,
        deviceType,
        ip,
        iat: new Date(payload.iat * 1000),
        exp: new Date(payload.exp * 1000),

        user: {
          connect: {
            id: userId,
          },
        },
      };

      await this.sessionsRepository.create(sessionData, tx);

      return { accessToken, refreshToken };
    });

    if (isNewSignup) {
      await this.eventBus.publish(new NewSignupEvent());
    }

    return tokens;
  }
}
