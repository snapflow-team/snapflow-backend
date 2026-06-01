import { PaymentProvider } from '@generated/prisma-payments';
import { PaymentWithSubscriptionAndCustomer } from '../../types/payment-with-subscription.type';
import { Label } from '../../../../setup/configuration/business-rules-settings';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentViewDto {
  @ApiProperty({
    description: 'Идентификатор пользователя',
    example: '1',
  })
  userId: string;

  @ApiProperty({
    description: 'Идентификатор подписки',
    example: '42',
  })
  subscriptionId: string;

  @ApiProperty({
    description: 'Дата и время успешного платежа (ISO-8601)',
    example: '2026-04-21T10:30:00.000Z',
  })
  dateOfPayment: string;

  @ApiProperty({
    type: 'string',
    description: 'Дата окончания подписки (ISO-8601) или null',
    example: '2026-05-21T10:30:00.000Z',
    nullable: true,
  })
  endDateOfSubscription: string | null;

  @ApiProperty({
    description: 'Сумма платежа в minor units',
    example: 1000,
  })
  price: number;

  @ApiProperty({
    description: 'Человекочитаемый тип подписки',
    example: Label.BusinessMonthly,
    enum: Label,
  })
  subscriptionType: Label;

  @ApiProperty({
    description: 'Платежный провайдер',
    example: PaymentProvider.STRIPE,
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  static mapToView(payment: PaymentWithSubscriptionAndCustomer): PaymentViewDto {
    const dto = new this();

    dto.userId = payment.subscription.customer.userId.toString();
    dto.subscriptionId = payment.subscriptionId.toString();
    dto.dateOfPayment = payment.createdAt.toISOString();
    dto.endDateOfSubscription = payment.subscription.currentPeriodEnd?.toISOString() ?? null;
    dto.price = payment.amount;
    dto.subscriptionType =
      payment.planId === 'business_monthly' ? Label.BusinessMonthly : Label.BusinessYearly;
    dto.provider = payment.provider;

    return dto;
  }
}
