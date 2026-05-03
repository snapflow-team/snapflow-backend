import { ApiProperty } from '@nestjs/swagger';
import { PaginatedViewDto } from '../../../../common/dto/paginated.view-dto';
import { PaymentViewDto } from './payment.view-dto';

export class PaginatedPaymentsSwaggerDto extends PaginatedViewDto<PaymentViewDto> {
  @ApiProperty({
    description: 'Количество страниц',
    example: 1,
  })
  declare pagesCount: number;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  declare page: number;

  @ApiProperty({
    description: 'Размер страницы',
    example: 10,
  })
  declare pageSize: number;

  @ApiProperty({
    description: 'Общее количество элементов',
    example: 1,
  })
  declare totalCount: number;

  @ApiProperty({
    description: 'Список платежей. Возвращаются только платежи со статусом PAID',
    type: PaymentViewDto,
    isArray: true,
  })
  declare items: PaymentViewDto[];
}
