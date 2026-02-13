import { Request } from 'express';
import { Module } from '@nestjs/common';
import { UsersRepository } from './users/infrastructure/users.repository';
import { AuthController } from './auth/api/auth.controller';
import { RegisterUserUseCase } from './auth/application/usecases/register-user.useсase';
import { DateService } from '../../../../../libs/common/services/date.service';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { UserValidationService } from './users/application/services/user-validation.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfirmationEmailUseCase } from './auth/application/usecases/confirmation-email.usecase';
import { LocalStrategy } from './auth/domain/guards/local/local.strategy';
import { LoginUserUseCase } from './auth/application/usecases/login-user.usecase';
import { CreateSessionUseCase } from './auth/sessions/application/usecases/create-session.usecase';
import { SessionsRepository } from './auth/sessions/infrastructure/sessions.repository';
import { UserAccountsConfig } from './config/user-accounts.config';
import { AccessTokenProvider } from './auth/providers/access-token.provider';
import { RefreshTokenProvider } from './auth/providers/refresh-token.provider';
import { JwtRefreshStrategy } from './auth/domain/guards/bearer/jwt-refresh.strategy';
import { LogoutUseCase } from './auth/application/usecases/logout.usecase';
import { PasswordRecoveryUseCase } from './auth/application/usecases/password-recovery.usecase';
import { RegistrationEmailResendingUseCase } from './auth/application/usecases/registration-email-resending.usecase';
import { NewPasswordUseCase } from './auth/application/usecases/new-password.usecase';
import { GetMeQueryHandler } from './auth/application/queries/get-me.query-handler';
import { JwtStrategy } from './auth/domain/guards/bearer/jwt.strategy';
import { UsersQueryRepository } from './users/infrastructure/users.query-repository';
import { GoogleStrategy } from './auth/domain/guards/google/google.strategy';
import { AuthGoogleCommandUseCase } from './auth/application/usecases/auth-google.usecase';
import { AuthTokenService } from '../../../../../libs/common/services/auth-token.service';
import { RefreshTokenUseCase } from './auth/application/usecases/refresh-token.usecase';
import { CheckPasswordRecoveryCodeUseCase } from './auth/application/usecases/check-password-recovery-code.usecase';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { RecaptchaBody } from '../../types/recaptcha.types';
import { UserAccountsConfigModule } from './config/user-accounts.config-module';

const controllers = [AuthController];
const useCases = [
  RegisterUserUseCase,
  ConfirmationEmailUseCase,
  LoginUserUseCase,
  LogoutUseCase,
  CreateSessionUseCase,
  RegistrationEmailResendingUseCase,
  PasswordRecoveryUseCase,
  CheckPasswordRecoveryCodeUseCase,
  NewPasswordUseCase,
  AuthGoogleCommandUseCase,
  RefreshTokenUseCase,
];
const queries = [GetMeQueryHandler];
const services = [DateService, CryptoService, UserValidationService, AuthTokenService];
const repositories = [UsersRepository, UsersQueryRepository, SessionsRepository];
const strategies = [LocalStrategy, JwtStrategy, JwtRefreshStrategy, GoogleStrategy];
const configs = [UserAccountsConfig];

@Module({
  imports: [
    NotificationsModule,
    GoogleRecaptchaModule.forRootAsync({
      imports: [UserAccountsConfigModule],
      inject: [UserAccountsConfig],
      useFactory: (config: UserAccountsConfig) => ({
        secretKey: config.googleRecaptchaSecretKey,
        response: (req: Request<unknown, unknown, RecaptchaBody>) =>
          req.body['g-recaptcha-response'] ?? '',
        skipMissing: false,
      }),
    }),
  ],
  controllers: [...controllers],
  providers: [
    AccessTokenProvider,
    RefreshTokenProvider,
    ...useCases,
    ...queries,
    ...services,
    ...repositories,
    ...strategies,
    ...configs,
  ],
  exports: [],
})
export class UserAccountsModule {}
