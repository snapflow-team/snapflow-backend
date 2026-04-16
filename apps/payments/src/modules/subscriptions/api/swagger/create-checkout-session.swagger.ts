import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateCheckoutSessionInputDto } from '../input-dto/create-checkout-session.input-dto';
import { CheckoutSessionUrlViewDto } from '../view-dto/checkout-session-url.view-dto';

export function CreateCheckoutSessionSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Создать Stripe Checkout Session для оформления подписки',
    }),
    ApiBody({
      type: CreateCheckoutSessionInputDto,
    }),
    ApiCreatedResponse({
      description:
        'Успешно создана Stripe Checkout Session. В ответе возвращается URL для редиректа.',
      type: CheckoutSessionUrlViewDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован или передан недействительный access-токен',
    }),
    ApiBadRequestResponse({
      description: 'Передан несуществующий или недоступный тарифный план',
    }),
  );
}
