import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlanViewDto } from '../view-dto/plan.view-dto';

export function GetPlansSwagger() {
  return applyDecorators(
    ApiTags('Subscriptions'),
    ApiOperation({
      summary: 'Получить список тарифных планов подписки',
    }),
    ApiOkResponse({
      description: 'Список доступных тарифных планов',
      type: PlanViewDto,
      isArray: true,
    }),
  );
}
