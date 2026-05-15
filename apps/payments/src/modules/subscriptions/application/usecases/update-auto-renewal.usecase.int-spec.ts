import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from '../services/stripe.service';
import { Notification } from '../../../../common/notification/notification';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { SubscriptionStatus } from '@generated/prisma-payments';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentsModule } from '../../../../payments.module';
import { SubscriptionsRepository } from '../../infrastructure/subscriptions.repository';
import { UpdateAutoRenewalCommand, UpdateAutoRenewalUseCase } from './update-auto-renewal.usecase';

describe('UpdateAutoRenewalUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UpdateAutoRenewalUseCase;
  let prisma: PrismaService;
  let subscriptionRepository: SubscriptionsRepository;

  const updateAutoRenewalMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({ updateAutoRenewal: updateAutoRenewalMock })
      .compile();

    useCase = module.get(UpdateAutoRenewalUseCase);
    prisma = module.get(PrismaService);
    subscriptionRepository = module.get(SubscriptionsRepository);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );

    updateAutoRenewalMock.mockClear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  // ------------------ POSITIVE ------------------

  describe('Позитивные сценарии', () => {
    it('должен обновить autoRenewal в Stripe и в БД', async () => {
      const userId = 1;

      // создаем customer + subscription
      const customer = await prisma.customer.create({
        data: { userId },
      });

      const subscription = await prisma.subscription.create({
        data: {
          customerId: customer.id,
          status: SubscriptionStatus.ACTIVE,
          autoRenewal: true,
          stripeSubId: 'stripe_sub_123',
          planId: 'business_monthly',
        },
      });

      updateAutoRenewalMock.mockResolvedValue(Notification.ok());

      const command = new UpdateAutoRenewalCommand({
        userId,
        autoRenewal: false,
      });

      const result = await useCase.execute(command);

      // 1. OK
      expect(result.hasErrors).toBe(false);

      // 2. Stripe вызвался
      expect(updateAutoRenewalMock).toHaveBeenCalledWith('stripe_sub_123', false);

      // 3. Проверяем БД
      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.autoRenewal).toBe(false);
    });

    it('ничего не делает, если autoRenewal не изменился', async () => {
      const userId = 2;

      const customer = await prisma.customer.create({
        data: { userId },
      });

      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          status: SubscriptionStatus.ACTIVE,
          autoRenewal: true,
          stripeSubId: 'stripe_sub_123',
          planId: 'business_monthly',
        },
      });

      const command = new UpdateAutoRenewalCommand({
        userId,
        autoRenewal: true,
      });

      const result = await useCase.execute(command);

      expect(result.hasErrors).toBe(false);

      // Stripe НЕ вызывается
      expect(updateAutoRenewalMock).not.toHaveBeenCalled();
    });
  });

  // ------------------ NEGATIVE ------------------

  describe('Негативные сценарии', () => {
    it('должен вернуть BadRequest если нет подписки', async () => {
      const command = new UpdateAutoRenewalCommand({
        userId: 999,
        autoRenewal: true,
      });

      const result = await useCase.execute(command);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);

      expect(updateAutoRenewalMock).not.toHaveBeenCalled();
    });

    it('должен вернуть ошибку если нет stripeSubId', async () => {
      const userId = 3;

      const customer = await prisma.customer.create({
        data: { userId },
      });

      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          status: SubscriptionStatus.ACTIVE,
          autoRenewal: true,
          stripeSubId: null, // ключевой момент
          planId: 'business_monthly',
        },
      });

      const command = new UpdateAutoRenewalCommand({
        userId,
        autoRenewal: false,
      });

      const result = await useCase.execute(command);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      expect(updateAutoRenewalMock).not.toHaveBeenCalled();
    });

    it('должен пробросить ошибку Stripe', async () => {
      const userId = 4;

      const customer = await prisma.customer.create({
        data: { userId },
      });

      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          status: SubscriptionStatus.ACTIVE,
          autoRenewal: true,
          stripeSubId: 'stripe_sub_123',
          planId: 'business_monthly',
        },
      });

      updateAutoRenewalMock.mockResolvedValue(
        Notification.fail(NotificationResultCode.InternalServerError, 'Stripe error'),
      );

      const command = new UpdateAutoRenewalCommand({
        userId,
        autoRenewal: false,
      });

      const result = await useCase.execute(command);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      // В БД не должно измениться
      const sub = await prisma.subscription.findFirst({
        where: { customer: { userId } },
      });

      expect(sub?.autoRenewal).toBe(true);
    });

    it('должен упасть если БД не обновилась', async () => {
      const userId = 5;

      const customer = await prisma.customer.create({
        data: { userId },
      });

      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          status: SubscriptionStatus.ACTIVE,
          autoRenewal: true,
          stripeSubId: 'stripe_sub_123',
          planId: 'business_monthly',
        },
      });

      updateAutoRenewalMock.mockResolvedValue(Notification.ok());

      jest
        .spyOn(subscriptionRepository, 'updateAutoRenewal')
        .mockRejectedValueOnce(new Error('DB error'));

      const command = new UpdateAutoRenewalCommand({
        userId,
        autoRenewal: false,
      });

      const res = await useCase.execute(command);
      expect(res).toBeInstanceOf(Notification);
      expect(res.code).toBe(NotificationResultCode.InternalServerError);
    });
  });
});
