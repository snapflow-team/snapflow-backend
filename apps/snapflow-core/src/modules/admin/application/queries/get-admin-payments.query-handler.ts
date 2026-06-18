import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  InternalPaymentItem,
  InternalPaymentsPaginatedResponse,
} from '../../../../../../../libs/contracts/payments/constants/internal-payments-api.contract';
import { AdminPaymentModel } from '../../api/models/admin-payment.model';
import { PaginatedAdminPaymentsModel } from '../../api/models/paginated-admin-payments.model';
import { AdminPaymentsSortField } from '../../domain/enums/admin-payments-sort-field.enum';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPaymentsHttpClient } from '../../infrastructure/clients/admin-payments-http.client';
import { mapAdminPaymentsParamsToInternal } from '../../infrastructure/mappers/admin-payments-sort.mapper';
import {
  AdminUserBrief,
  AdminUsersQueryRepository,
} from '../../infrastructure/repositories/admin-users.query-repository';
import { GetAdminPaymentsQueryParams } from '../dto/get-admin-payments-query.params';

export class GetAdminPaymentsQuery {
  constructor(public readonly params: GetAdminPaymentsQueryParams) {}
}

@QueryHandler(GetAdminPaymentsQuery)
export class GetAdminPaymentsQueryHandler
  implements IQueryHandler<GetAdminPaymentsQuery, PaginatedAdminPaymentsModel>
{
  constructor(
    private readonly adminPaymentsHttpClient: AdminPaymentsHttpClient,
    private readonly adminUsersQueryRepository: AdminUsersQueryRepository,
  ) {}

  async execute({ params }: GetAdminPaymentsQuery): Promise<PaginatedAdminPaymentsModel> {
    if (params.sortBy === AdminPaymentsSortField.Username) {
      return this.executeWithUsernameSort(params);
    }

    return this.executeWithPaymentsPagination(params);
  }

  private async executeWithPaymentsPagination(
    params: GetAdminPaymentsQueryParams,
  ): Promise<PaginatedAdminPaymentsModel> {
    const userIds: number[] = await this.resolveUserIdsForSearch(params.search);

    if (params.search && userIds.length === 0) {
      return this.emptyResult(params);
    }

    const response: InternalPaymentsPaginatedResponse =
      await this.adminPaymentsHttpClient.getPayments(
        mapAdminPaymentsParamsToInternal(params, userIds.length ? userIds : undefined),
      );

    const usersById: Map<number, AdminUserBrief> =
      await this.adminUsersQueryRepository.findUsersByIds(
        response.items.map((payment) => Number(payment.userId)),
      );

    return {
      items: this.enrichPayments(response.items, usersById),
      pageInfo: {
        page: response.page,
        pageSize: response.pageSize,
        totalCount: response.totalCount,
        pagesCount: response.pagesCount,
      },
    };
  }

  private async executeWithUsernameSort(
    params: GetAdminPaymentsQueryParams,
  ): Promise<PaginatedAdminPaymentsModel> {
    const userIds: number[] = await this.resolveUserIdsForSearch(params.search);

    if (params.search && userIds.length === 0) {
      return this.emptyResult(params);
    }

    const response = await this.adminPaymentsHttpClient.getPayments(
      mapAdminPaymentsParamsToInternal(
        new GetAdminPaymentsQueryParams({
          page: 1,
          pageSize: Number.MAX_SAFE_INTEGER,
          search: params.search,
          sortBy: params.sortBy,
          sortDirection: params.sortDirection,
        }),
        userIds.length ? userIds : undefined,
      ),
    );

    const usersById: Map<number, AdminUserBrief> =
      await this.adminUsersQueryRepository.findUsersByIds(
        response.items.map((payment) => Number(payment.userId)),
      );

    const sortedItems: AdminPaymentModel[] = this.sortByUsername(
      this.enrichPayments(response.items, usersById),
      params.sortDirection,
    );
    const totalCount: number = sortedItems.length;
    const pagesCount: number = totalCount === 0 ? 0 : Math.ceil(totalCount / params.pageSize);
    const skip: number = params.calculateSkip();

    return {
      items: sortedItems.slice(skip, skip + params.pageSize),
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        pagesCount,
      },
    };
  }

  private async resolveUserIdsForSearch(search?: string): Promise<number[]> {
    if (!search) {
      return [];
    }

    return this.adminUsersQueryRepository.findUserIdsByUsernameSearch(search);
  }

  private enrichPayments(
    payments: InternalPaymentItem[],
    usersById: Map<number, AdminUserBrief>,
  ): AdminPaymentModel[] {
    return payments.flatMap((payment) => {
      const userId: number = Number(payment.userId);
      const user: AdminUserBrief | undefined = usersById.get(userId);

      if (!user) {
        return [];
      }

      return [
        {
          userId,
          username: user.username,
          avatarUrl: user.avatarUrl,
          date: payment.dateOfPayment,
          amount: payment.price,
          subscriptionType: payment.subscriptionType,
          provider: payment.provider,
        },
      ];
    });
  }

  private sortByUsername(
    items: AdminPaymentModel[],
    sortDirection: AdminSortDirection,
  ): AdminPaymentModel[] {
    const direction: 1 | -1 = sortDirection === AdminSortDirection.Ascending ? 1 : -1;

    return [...items].sort(
      (a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }) * direction,
    );
  }

  private emptyResult(params: GetAdminPaymentsQueryParams): PaginatedAdminPaymentsModel {
    return {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount: 0,
        pagesCount: 0,
      },
    };
  }
}
