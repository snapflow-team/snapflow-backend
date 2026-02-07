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

const controllers = [AuthController];
const useCases = [
  RegisterUserUseCase,
  ConfirmationEmailUseCase,
  LoginUserUseCase,
  LogoutUseCase,
  CreateSessionUseCase,
];
const services = [DateService, CryptoService, UserValidationService];
const repositories = [UsersRepository, SessionsRepository];
const strategies = [LocalStrategy, JwtRefreshStrategy];
const configs = [UserAccountsConfig];

@Module({
  imports: [NotificationsModule],
  controllers: [...controllers],
  providers: [
    AccessTokenProvider,
    RefreshTokenProvider,
    ...useCases,
    ...services,
    ...repositories,
    ...strategies,
    ...configs,
  ],
  exports: [],
})
export class UserAccountsModule {}
