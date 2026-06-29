import { Request } from 'express';
import { forwardRef, Module } from '@nestjs/common';
import { UsersRepository } from './users/infrastructure/users.repository';
import { AuthController } from './auth/api/auth.controller';
import { RegisterUserUseCase } from './auth/application/usecases/register-user.useсase';
import { DateService } from '../../../../../libs/common/services/date.service';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { UserValidationService } from './users/application/services/user-validation.service';
import { ConfirmationEmailUseCase } from './auth/application/usecases/confirmation-email.usecase';
import { LocalStrategy } from './auth/domain/guards/local/local.strategy';
import { LoginUserUseCase } from './auth/application/usecases/login-user.usecase';
import { CreateSessionUseCase } from './auth/sessions/application/usecases/create-session.usecase';
import { SessionsRepository } from './auth/sessions/infrastructure/sessions.repository';
import { JwtRefreshStrategy } from './auth/domain/guards/bearer/jwt-refresh.strategy';
import { LogoutUseCase } from './auth/application/usecases/logout.usecase';
import { PasswordRecoveryUseCase } from './auth/application/usecases/password-recovery.usecase';
import { RegistrationEmailResendingUseCase } from './auth/application/usecases/registration-email-resending.usecase';
import { NewPasswordUseCase } from './auth/application/usecases/new-password.usecase';
import { GetMeQueryHandler } from './auth/application/queries/get-me.query-handler';
import { JwtStrategy } from './auth/domain/guards/bearer/jwt.strategy';
import { UsersQueryRepository } from './users/infrastructure/users.query-repository';
import { RefreshTokenUseCase } from './auth/application/usecases/refresh-token.usecase';
import { CheckPasswordRecoveryCodeUseCase } from './auth/application/usecases/check-password-recovery-code.usecase';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { RecaptchaBody } from './types/recaptcha.types';
import { SessionsCleanupService } from './auth/sessions/application/services/sessions-cleanup.service';
import { GithubStrategy } from './auth/domain/guards/github/github.strategy';
import { UserUtilsService } from './users/application/services/user-utils.service';
import { OAuthController } from './auth/api/oauth.controller';
import { OAuthUseCase } from './auth/application/usecases/oauth.usecase';
import { GoogleStrategy } from './auth/domain/guards/google/google.strategy';
import { DeleteSessionByDeviceUseCase } from './auth/sessions/application/usecases/delete-session-by-device-id.usecase';
import { GetAllSessionsQueryHandler } from './auth/sessions/application/queries/get-all-sessions.query';
import { SessionQueryRepository } from './auth/sessions/infrastructure/session.query-repository';
import { DeleteActiveSessionsUseCase } from './auth/sessions/application/usecases/delete-active-sessions.usercase';
import { SessionsController } from './auth/sessions/api/sessions.controller';
import { PostsController } from '../posts/api/posts.controller';
import { UpdateProfileUseCase } from './profiles/application/usecases/update-profile.usecase';
import { ProfileController } from './profiles/api/profile.controller';
import { ProfilesRepository } from './profiles/infrastructure/profiles.repository';
import { GetProfileQueryHandler } from './profiles/application/queries/get-profile.query-handler';
import { ProfilesQueryRepository } from './profiles/infrastructure/query/profiles.query-repository';
import { FilesClientModule } from '../integrations/files/files-client.module';
import { FilesMediaController } from '../integrations/files/api/files-media.controller';
import { MulterModule } from '@nestjs/platform-express';
import { UploadAvatarUseCase } from './profiles/application/usecases/upload-avatar.usecase';
import { DeleteAvatarUseCase } from './profiles/application/usecases/delete-avatar.usecase';
import { GetTotalCountRegisteredUsersQueryHandler } from './users/application/queries/get-total-count-registered-users.query-handler';
import { SearchUsersQueryHandler } from './users/application/queries/search-users.query-handler';
import { UsersController } from './users/api/users.controller';
import { GetPublicProfileQueryHandler } from './profiles/application/queries/get-public-profile.query-handler';
import { GetProfileFollowingQueryHandler } from './profiles/application/queries/get-profile-following.query-handler';
import { GetProfileFollowersQueryHandler } from './profiles/application/queries/get-profile-followers.query-handler';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../setup/configuration/configuration';
import { ApiSettings } from '../../setup/configuration/api-settings';
import { JwtAuthModule } from './auth/jwt-auth.module';
import { FollowsModule } from '../follows/follows.module';

const controllers = [
  AuthController,
  UsersController,
  SessionsController,
  OAuthController,
  PostsController,
  ProfileController,
  FilesMediaController,
];
const useCases = [
  RegisterUserUseCase,
  ConfirmationEmailUseCase,
  RegistrationEmailResendingUseCase,

  OAuthUseCase,

  LoginUserUseCase,
  LogoutUseCase,

  CreateSessionUseCase,
  DeleteSessionByDeviceUseCase,
  DeleteActiveSessionsUseCase,

  PasswordRecoveryUseCase,
  CheckPasswordRecoveryCodeUseCase,
  NewPasswordUseCase,

  RefreshTokenUseCase,

  UpdateProfileUseCase,
  UploadAvatarUseCase,
  DeleteAvatarUseCase,
];
const queries = [
  GetMeQueryHandler,
  GetTotalCountRegisteredUsersQueryHandler,
  SearchUsersQueryHandler,

  GetProfileQueryHandler,
  GetPublicProfileQueryHandler,
  GetProfileFollowingQueryHandler,
  GetProfileFollowersQueryHandler,

  GetAllSessionsQueryHandler,
];
const services = [
  DateService,
  CryptoService,
  UserUtilsService,
  UserValidationService,
  SessionsCleanupService,
];
const repositories = [
  UsersRepository,
  UsersQueryRepository,
  SessionsRepository,
  SessionQueryRepository,
  ProfilesRepository,
  ProfilesQueryRepository,
];
const strategies = [LocalStrategy, JwtStrategy, JwtRefreshStrategy, GoogleStrategy, GithubStrategy];

@Module({
  imports: [
    JwtAuthModule,
    forwardRef(() => FollowsModule),
    FilesClientModule,
    MulterModule.register(),
    GoogleRecaptchaModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => ({
        secretKey: configService.get<ApiSettings>('apiSettings').googleRecaptchaSecretKey,
        response: (req: Request<unknown, unknown, RecaptchaBody>) =>
          req.body['recaptchaToken'] ?? '',
        skipMissing: false,
      }),
    }),
  ],
  controllers: [...controllers],
  providers: [...useCases, ...queries, ...services, ...repositories, ...strategies],
  exports: [ProfilesRepository, UsersRepository, FilesClientModule],
})
export class UserAccountsModule {
  constructor() {}
}
