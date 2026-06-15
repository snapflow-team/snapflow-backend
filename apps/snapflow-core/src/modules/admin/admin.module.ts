import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../libs/common/services/date.service';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { AdminAuthResolver } from './api/resolvers/admin-auth.resolver';
import { AdminUsersResolver } from './api/resolvers/admin-users.resolver';
import { AdminUserDetailsResolver } from './api/resolvers/admin-user-details.resolver';
import { AdminPaymentsResolver } from './api/resolvers/admin-payments.resolver';
import { AdminLoginUseCase } from './application/usecases/admin-login.usecase';
import { AdminLogoutUseCase } from './application/usecases/admin-logout.usecase';
import { DeleteUserByAdminUseCase } from './application/usecases/delete-user-by-admin.usecase';
import { GetAdminUsersQueryHandler } from './application/queries/get-admin-users.query-handler';
import { GetAdminUserDetailsQueryHandler } from './application/queries/get-admin-user-details.query-handler';
import { GetAdminPaymentsQueryHandler } from './application/queries/get-admin-payments.query-handler';
import { AdminGqlAuthGuard } from './api/guards/admin-gql-auth.guard';
import { AdminGqlThrottlerGuard } from './api/guards/admin-gql-throttler.guard';
import { AdminSessionsRepository } from './infrastructure/repositories/admin-sessions.repository';
import { AdminUsersQueryRepository } from './infrastructure/repositories/admin-users.query-repository';
import { AdminSessionCookieService } from './infrastructure/services/admin-session-cookie.service';
import { AdminPaymentsHttpClient } from './infrastructure/clients/admin-payments-http.client';

@Module({
  imports: [HttpModule, UserAccountsModule],
  providers: [
    AdminAuthResolver,
    AdminUsersResolver,
    AdminUserDetailsResolver,
    AdminPaymentsResolver,
    AdminLoginUseCase,
    AdminLogoutUseCase,
    DeleteUserByAdminUseCase,
    GetAdminUsersQueryHandler,
    GetAdminUserDetailsQueryHandler,
    GetAdminPaymentsQueryHandler,
    AdminSessionsRepository,
    AdminUsersQueryRepository,
    AdminSessionCookieService,
    AdminPaymentsHttpClient,
    AdminGqlAuthGuard,
    AdminGqlThrottlerGuard,
    CryptoService,
    DateService,
  ],
})
export class AdminModule {}
