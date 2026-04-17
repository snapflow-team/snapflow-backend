import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionUrlViewDto {
  @ApiProperty({
    description: 'URL Stripe Checkout Session, на который нужно перенаправить пользователя',
    example: 'https://checkout.stripe.com/c/pay_1234567890abcdef',
  })
  url: string;
}
