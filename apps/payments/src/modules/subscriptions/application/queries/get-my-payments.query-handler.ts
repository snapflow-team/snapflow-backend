import { GetPaymentsQueryParams } from '../../api/input-dto/get-payments-query-params.input-dto';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../common/dto/paginated.view-dto';
import { PaymentViewDto } from '../../api/view-dto/payment.view-dto';
import { PaymentsQueryRepository } from '../../infrastructure/query/paments.query-repository';

export class GetMyPaymentsQuery {
  constructor(
    public readonly userId: number,
    public readonly queryParams: GetPaymentsQueryParams,
  ) {}
}

@QueryHandler(GetMyPaymentsQuery)
export class GetMyPaymentsQueryHandler
  implements IQueryHandler<GetMyPaymentsQuery, PaginatedViewDto<PaymentViewDto>>
{
  constructor(private readonly paymentsQueryRepository: PaymentsQueryRepository) {}

  execute({ userId, queryParams }: GetMyPaymentsQuery): Promise<PaginatedViewDto<PaymentViewDto>> {
    return this.paymentsQueryRepository.findPaymentsForUser(userId, queryParams);
  }
}
