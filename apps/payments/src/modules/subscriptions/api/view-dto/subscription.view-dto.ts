import { AccountType, Subscription, SubscriptionStatus } from '@generated/prisma-payments';
import { Label } from '../../../../setup/configuration/business-rules-settings';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionViewDto {
  @ApiProperty({
    description: 'Идентификатор подписки',
    example: '1',
  })
  subscriptionId: string;

  @ApiProperty({
    description: 'Статус подписки (ACTIVE или PAST_DUE)',
    example: 'ACTIVE',
    enum: SubscriptionStatus,
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Тип аккаунта (PERSONAL или BUSINESS)',
    example: 'BUSINESS',
    enum: AccountType,
  })
  accountType: AccountType;

  @ApiProperty({
    description: 'Тип подписки',
    example: 'business_monthly',
  })
  subscriptionType: string;

  @ApiProperty({
    description: 'Человекочитаемый тип подписки',
    example: Label.BusinessMonthly,
    enum: Label,
  })
  subscriptionLabel: Label;

  @ApiProperty({
    description: 'Дата окончания подписки (ISO-8601) или null',
    example: '2026-05-21T10:30:00.000Z',
    nullable: true,
  })
  expireAt: string | null;

  @ApiProperty({
    description: 'Дата следующего платежа (ISO-8601) или null',
    example: '2026-04-21T10:30:00.000Z',
  })
  nextPayment: string | null;

  // @ApiProperty({
  //   description: 'Платежный провайдер',
  //   example: PaymentProvider.STRIPE,
  //   enum: PaymentProvider,
  // })
  // provider: PaymentProvider;

  static mapToView(subscription: Subscription): SubscriptionViewDto {
    const dto = new this();

    dto.subscriptionId = subscription.id.toString();
    dto.status = subscription.status;
    dto.accountType = subscription.accountType;
    dto.subscriptionType = subscription.planId;
    dto.subscriptionLabel =
      subscription.planId === 'business_monthly' ? Label.BusinessMonthly : Label.BusinessYearly;
    dto.expireAt = subscription.currentPeriodEnd?.toISOString() ?? null;
    dto.nextPayment = subscription.nextPaymentAt?.toISOString() ?? null;

    return dto;
  }
}
