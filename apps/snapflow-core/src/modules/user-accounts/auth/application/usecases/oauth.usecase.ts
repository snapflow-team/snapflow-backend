import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { AuthTokenService } from '../../../../../../../../libs/common/services/auth-token.service';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { AuthAccount, ConfirmationStatus, Prisma, User } from '@generated/prisma';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { UserUtilsService } from '../../../users/application/services/user-utils.service';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { parseUserAgent } from '../../../../../../../../libs/common/utils/user-agent.parser';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { PrismaService } from '../../../../../database/prisma.service';
import { OAuthApplicationDto } from '../dto/oauth.application-dto';

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
  ) {}

  async execute({
    dto: { provider, providerAccountId, email, username, ip, userAgent },
  }: OAuthCommand): Promise<AuthTokens> {
    return this.prismaService.$transaction(async (tx) => {
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
        // todo: что делать если нет email?
        if (!email) {
          throw new DomainException({
            code: DomainExceptionCode.BadRequest,
            message: `${provider} user has no email`,
          });
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
        }
      }

      const deviceId: string = this.cryptoService.generateUUID();
      const deviceName: string = parseUserAgent(userAgent);
      const accessToken: string = this.authTokenService.generateAccessToken(userId);
      const refreshToken: string = this.authTokenService.generateRefreshToken(userId, deviceId);
      const payload: PayloadRefreshToken = this.authTokenService.decodeRefreshToken(refreshToken);

      const sessionData: Prisma.SessionCreateInput = {
        deviceId,
        deviceName,
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
  }
}
