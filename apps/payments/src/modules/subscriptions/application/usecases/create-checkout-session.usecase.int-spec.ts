import { Test, TestingModule } from '@nestjs/testing';
import { CreateCheckoutSessionCommand, CreateCheckoutSessionUseCase, } from './create-checkout-session.usecase';
import { StripeService } from '../services/stripe.service';
import { Notification } from '../../../../common/notification/notification';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentsModule } from '../../../../payments.module';

describe('CreateCheckoutSessionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateCheckoutSessionUseCase;
  let prisma: PrismaService;

  const createCheckoutSessionMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({ createCheckoutSession: createCheckoutSessionMock })
      .compile();

    useCase = module.get<CreateCheckoutSessionUseCase>(CreateCheckoutSessionUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE payments, subscriptions RESTART IDENTITY CASCADE',
    );

    createCheckoutSessionMock.mockClear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  describe('Позитивные сценарии', () => {
    it('должен успешно создать Stripe сессию, сохранить PENDING заказ в БД и вернуть URL', async () => {
      const userId = 100;
      const planId = 'business_monthly';
      const mockSessionId = 'test-session-id';
      const mockUrl = 'https://stripe.com/checkout/test';

      createCheckoutSessionMock.mockResolvedValue(
        Notification.ok({
          url: mockUrl,
          sessionId: mockSessionId,
        }),
      );

      const command = new CreateCheckoutSessionCommand({ userId, planId });
      const result: Notification<string> = await useCase.execute(command);

      // 1. Проверяем возврат URL
      expect(result.hasErrors).toBe(false);
      expect(result.value).toBe(mockUrl);

      // 2. Проверяем, что в БД создалась подписка
      const subscription = await prisma.subscription.findFirst({
        where: { userId, planId },
        include: { payments: true },
      });

      expect(subscription).toBeDefined();
      expect(subscription?.status).toBe(SubscriptionStatus.PENDING);

      // 3. Проверяем запись платежа
      const payment = subscription?.payments[0];
      expect(payment).toBeDefined();
      expect(payment?.externalId).toBe(mockSessionId);
      expect(payment?.amount).toBeGreaterThan(0);
      expect(payment?.status).toBe(PaymentStatus.PENDING);
    });
  });

  describe('Негативные сценарии', () => {
    it('должен вернуть BadRequest, если тарифный план не существует в системе', async () => {
      const userId = 200;
      const nonExistentPlanId = 'wrong-plan-id';

      const command = new CreateCheckoutSessionCommand({ userId, planId: nonExistentPlanId });
      const result: Notification<string> = await useCase.execute(command);

      // 1. Проверяем ошибку валидации плана
      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(result.extensions[0].field).toBe('planId');

      // 2. Stripe не должен вызываться
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();

      // 3. В БД пусто
      const subCount: number = await prisma.subscription.count();
      expect(subCount).toBe(0);
    });

    it('должен пробросить ошибку, если StripeService вернул fail', async () => {
      const userId = 300;
      const planId = 'business_monthly';

      createCheckoutSessionMock.mockResolvedValue(
        Notification.fail(NotificationResultCode.InternalServerError, 'Stripe connection error'),
      );

      const command = new CreateCheckoutSessionCommand({ userId, planId });
      const result: Notification<string> = await useCase.execute(command);

      // 1. Проверяем проброс ошибки
      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      // 2. Проверяем, что заказ в БД не создался (атомарность)
      const subCount = await prisma.subscription.count();
      expect(subCount).toBe(0);
    });

    it('должен упасть с ошибкой, если база данных недоступна при сохранении заказа', async () => {
      const userId = 400;
      const planId = 'business_monthly';

      createCheckoutSessionMock.mockResolvedValue(
        Notification.ok({ url: 'http://ok.com', sessionId: 'id_123' }),
      );

      // Имитируем падение БД
      jest.spyOn(prisma.subscription, 'create').mockRejectedValueOnce(new Error('Prisma error'));

      const command = new CreateCheckoutSessionCommand({ userId, planId });

      await expect(useCase.execute(command)).rejects.toThrow('Prisma error');
    });
  });
});
