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
import { BanUserByAdminUseCase } from './application/usecases/ban-user-by-admin.usecase';
import { UnbanUserByAdminUseCase } from './application/usecases/unban-user-by-admin.usecase';
import { GetAdminUsersQueryHandler } from './application/queries/get-admin-users.query-handler';
import { GetAdminUserDetailsQueryHandler } from './application/queries/get-admin-user-details.query-handler';
import { GetAdminPaymentsQueryHandler } from './application/queries/get-admin-payments.query-handler';
import { AdminGqlAuthGuard } from './api/guards/admin-gql-auth.guard';
import { AdminGqlThrottlerGuard } from './api/guards/admin-gql-throttler.guard';
import { AdminSessionsRepository } from './infrastructure/repositories/admin-sessions.repository';
import { AdminUsersQueryRepository } from './infrastructure/repositories/admin-users.query-repository';
import { AdminSessionCookieService } from './infrastructure/services/admin-session-cookie.service';
import { AdminPaymentsHttpClient } from './infrastructure/clients/admin-payments-http.client';
import { AdminPostsResolver } from './api/resolvers/admin-posts.resolver';
import { AdminPostsQueryRepository } from './infrastructure/repositories/admin-posts.query-repository';
import { GetAdminPostsQueryHandler } from './application/queries/get-admin-posts.query-handler';
import { pubSubProvider } from './providers/pub-sub.provider';
import { PostCreatedSubscriptionEventHandler } from './application/events/handlers/post-created-subscripition.event-handler';
const resolvers = [
  AdminAuthResolver,
  AdminUsersResolver,
  AdminUserDetailsResolver,
  AdminPaymentsResolver,
  AdminPostsResolver,
];
const useCases = [
  AdminLoginUseCase,
  AdminLogoutUseCase,
  DeleteUserByAdminUseCase,
  BanUserByAdminUseCase,
  UnbanUserByAdminUseCase,
];
const queryHandlers = [
  GetAdminUsersQueryHandler,
  GetAdminUserDetailsQueryHandler,
  GetAdminPaymentsQueryHandler,
  GetAdminPostsQueryHandler,
];
const services = [AdminSessionCookieService, AdminPaymentsHttpClient, CryptoService, DateService];
const repositories = [
  AdminSessionsRepository,
  AdminUsersQueryRepository,
  AdminPostsQueryRepository,
];
const guards = [AdminGqlAuthGuard, AdminGqlThrottlerGuard];
const providers = [pubSubProvider, PostCreatedSubscriptionEventHandler];
@Module({
  imports: [HttpModule, UserAccountsModule],
  providers: [
    ...resolvers,
    ...useCases,
    ...queryHandlers,
    ...repositories,
    ...services,
    ...guards,
    ...providers,
  ],
})
export class AdminModule {}
