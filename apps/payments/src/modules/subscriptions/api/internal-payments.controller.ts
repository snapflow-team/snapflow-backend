import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalApiSecretGuard } from '../../auth/guards/internal-api-secret.guard';
import { GetAllPaymentsQuery } from '../application/queries/get-all-payments.query-handler';
import { GetInternalPaymentsQueryParamsInputDto } from './input-dto/get-internal-payments-query-params.input-dto';
import { InternalPaymentsPaginatedResponse } from 'libs/contracts/payments';

@ApiExcludeController()
@Controller('internal/payments')
export class InternalPaymentsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @UseGuards(InternalApiSecretGuard)
  async getAllPayments(
    @Query() query: GetInternalPaymentsQueryParamsInputDto,
  ): Promise<InternalPaymentsPaginatedResponse> {
    return this.queryBus.execute<GetAllPaymentsQuery, InternalPaymentsPaginatedResponse>(
      new GetAllPaymentsQuery(query),
    );
  }
}
