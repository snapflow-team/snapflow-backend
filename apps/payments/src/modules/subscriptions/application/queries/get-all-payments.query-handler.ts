import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InternalPaymentsPaginatedResponse } from 'libs/contracts/payments';
import { PaymentsQueryRepository } from '../../infrastructure/query/payments.query-repository';
import { GetInternalPaymentsQueryParamsInputDto } from '../../api/input-dto/get-internal-payments-query-params.input-dto';

export class GetAllPaymentsQuery {
  constructor(public readonly params: GetInternalPaymentsQueryParamsInputDto) {}
}

@QueryHandler(GetAllPaymentsQuery)
export class GetAllPaymentsQueryHandler
  implements IQueryHandler<GetAllPaymentsQuery, InternalPaymentsPaginatedResponse>
{
  constructor(private readonly paymentsQueryRepository: PaymentsQueryRepository) {}

  execute({ params }: GetAllPaymentsQuery): Promise<InternalPaymentsPaginatedResponse> {
    return this.paymentsQueryRepository.findAllPaymentsPaginated(params);
  }
}
