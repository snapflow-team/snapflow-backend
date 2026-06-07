import { Module } from '@nestjs/common';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../libs/common/services/date.service';
import { AdminSchemaPlaceholderResolver } from './api/resolvers/admin-schema-placeholder.resolver';
import { AdminAuthResolver } from './api/resolvers/admin-auth.resolver';
import { AdminLoginUseCase } from './application/usecases/admin-login.usecase';
import { AdminLogoutUseCase } from './application/usecases/admin-logout.usecase';
import { AdminGqlAuthGuard } from './api/guards/admin-gql-auth.guard';
import { AdminGqlThrottlerGuard } from './api/guards/admin-gql-throttler.guard';
import { AdminSessionsRepository } from './infrastructure/repositories/admin-sessions.repository';
import { AdminSessionCookieService } from './infrastructure/services/admin-session-cookie.service';

@Module({
  providers: [
    AdminSchemaPlaceholderResolver,
    AdminAuthResolver,
    AdminLoginUseCase,
    AdminLogoutUseCase,
    AdminSessionsRepository,
    AdminSessionCookieService,
    AdminGqlAuthGuard,
    AdminGqlThrottlerGuard,
    CryptoService,
    DateService,
  ],
})
export class AdminModule {}
