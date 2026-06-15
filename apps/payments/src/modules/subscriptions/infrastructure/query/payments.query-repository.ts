import { PrismaService } from '../../../database/prisma.service';
import { GetPaymentsQueryParams } from '../../api/input-dto/get-payments-query-params.input-dto';
import { PaginatedViewDto } from '../../../../common/dto/paginated.view-dto';
import { PaymentViewDto } from '../../api/view-dto/payment.view-dto';
import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@generated/prisma-payments';
import {
  InternalPaymentsPaginatedResponse,
  InternalPaymentsSortField,
} from 'libs/contracts/payments';
import { GetInternalPaymentsQueryParamsInputDto } from '../../api/input-dto/get-internal-payments-query-params.input-dto';

const internalPaymentsSortFieldToDbColumn: Record<InternalPaymentsSortField, string> = {
  [InternalPaymentsSortField.Date]: 'createdAt',
  [InternalPaymentsSortField.Amount]: 'amount',
  [InternalPaymentsSortField.Provider]: 'provider',
};

@Injectable()
export class PaymentsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPaymentsForUser(
    userId: number,
    queryParams: GetPaymentsQueryParams,
  ): Promise<PaginatedViewDto<PaymentViewDto>> {
    const { pageNumber, pageSize, sortDirection, sortBy }: GetPaymentsQueryParams = queryParams;
    const where = {
      deletedAt: null,
      status: PaymentStatus.PAID,
      subscription: {
        deletedAt: null,
        customer: {
          userId,
          deletedAt: null,
        },
      },
    };

    const [payments, totalCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          subscription: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: { [sortBy]: sortDirection },
        skip: queryParams.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount: Math.ceil(totalCount / pageSize),
      items: payments.map((p) => PaymentViewDto.mapToView(p)),
    };
  }

  async findAllPaymentsPaginated(
    queryParams: GetInternalPaymentsQueryParamsInputDto,
  ): Promise<InternalPaymentsPaginatedResponse> {
    const { pageSize, sortDirection, sortBy, userIds } = queryParams;
    const where = {
      deletedAt: null,
      status: PaymentStatus.PAID,
      subscription: {
        deletedAt: null,
        customer: {
          deletedAt: null,
          ...(userIds?.length ? { userId: { in: userIds } } : {}),
        },
      },
    };

    const [payments, totalCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          subscription: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: { [internalPaymentsSortFieldToDbColumn[sortBy]]: sortDirection },
        skip: queryParams.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      page: queryParams.page,
      pageSize,
      totalCount,
      pagesCount: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
      items: payments.map((payment) => PaymentViewDto.mapToInternalItem(payment)),
    };
  }
}
