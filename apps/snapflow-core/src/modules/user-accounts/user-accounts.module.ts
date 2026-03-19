import { Request } from 'express';
import { Module } from '@nestjs/common';
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
import { AuthTokenService } from '../../../../../libs/common/services/auth-token.service';
import { RefreshTokenUseCase } from './auth/application/usecases/refresh-token.usecase';
import { CheckPasswordRecoveryCodeUseCase } from './auth/application/usecases/check-password-recovery-code.usecase';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { RecaptchaBody } from './types/recaptcha.types';
import { UserAccountsConfigModule } from './config/user-accounts.config-module';
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
import { PublishPostUseCase } from '../posts/application/usecases/publish-post.use.case';
import { PostsRepository } from '../posts/infrastructure/posts-repository';
import { PostsController } from '../posts/api/posts.controller';
import { PostsQueryRepository } from '../posts/infrastructure/posts.query-repository';
import { GetPostQueryHandler } from '../posts/application/queries/get-post.query-handler';
import { GetProfilePostsQueryHandler } from '../posts/application/queries/get-profile-posts.query-handler';
import { CreatePostUseCase } from '../posts/application/usecases/create-post-use.case';
import { UpdateProfileUseCase } from './users/profile/application/usecases/update-profile.usecase';
import { ProfileController } from './users/profile/api/profile.controller';
import { ProfilesRepository } from './users/profile/infrastructure/profiles.repository';
import { GetProfileQueryHandler } from './users/profile/application/queries/get-profile.query-handler';
import { ProfilesQueryRepository } from './users/profile/infrastructure/query/profiles.query-repository';
import { EmailModule } from '../emails/email-module';
import { EditPostUseCase } from '../posts/application/usecases/edit-post.use.case';
import { DeletePostUseCase } from '../posts/application/usecases/delete-post.use.case';
import { FilesClientModule } from '../integrations/files/files-client.module';
import { FilesClient } from '../integrations/files/files.client';
import { FilesMediaController } from '../integrations/files/api/files-media.controller';
import { MulterModule } from '@nestjs/platform-express';
import { UploadAvatarUseCase } from './users/profile/application/usecases/upload-avatar.usecase';
import { DeleteAvatarUseCase } from './users/profile/application/usecases/delete-avatar.usecase';
import { GetTotalCountRegisteredUsersQueryHandler } from './users/application/queries/get-total-count-registered-users.query-handler';
import { UsersController } from './users/api/users.controller';
import { GetPublicProfileQueryHandler } from './users/profile/application/queries/get-public-profile.query-handler';

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

  CreatePostUseCase,
  PublishPostUseCase,
  EditPostUseCase,
  DeletePostUseCase,
];
const queries = [
  GetMeQueryHandler,
  GetTotalCountRegisteredUsersQueryHandler,

  GetProfilePostsQueryHandler,
  GetProfileQueryHandler,
  GetPublicProfileQueryHandler,

  GetAllSessionsQueryHandler,

  GetPostQueryHandler,
];
const services = [
  FilesClient,
  DateService,
  CryptoService,
  UserUtilsService,
  UserValidationService,
  AuthTokenService,
  SessionsCleanupService,
];
const repositories = [
  UsersRepository,
  UsersQueryRepository,
  SessionsRepository,
  SessionQueryRepository,
  PostsRepository,
  PostsQueryRepository,
  ProfilesRepository,
  ProfilesQueryRepository,
];
const strategies = [LocalStrategy, JwtStrategy, JwtRefreshStrategy, GoogleStrategy, GithubStrategy];
const configs = [UserAccountsConfig];

@Module({
  imports: [
    EmailModule,
    FilesClientModule,
    MulterModule.register(),
    GoogleRecaptchaModule.forRootAsync({
      imports: [UserAccountsConfigModule],
      inject: [UserAccountsConfig],
      // todo: выпилить UserAccountsConfig!
      useFactory: (config: UserAccountsConfig) => ({
        secretKey: config.googleRecaptchaSecretKey,
        response: (req: Request<unknown, unknown, RecaptchaBody>) =>
          req.body['recaptchaToken'] ?? '',
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
