import { Test, TestingModule } from '@nestjs/testing';
import { AccountType } from '@generated/prisma-snapflow';
import {
  PaymentsRoutingKey,
  SubscriptionActivatedEvent,
  SubscriptionRenewalFailedEvent,
} from '../../../../../../libs/contracts/payments';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { UsersRepository } from '../../user-accounts/users/infrastructure/users.repository';
import { LoggerFactory } from '../../logger/logger.factory';

function createPaymentCompletedPayload(
  overrides: Partial<SubscriptionActivatedEvent> = {},
): SubscriptionActivatedEvent {
  return {
    userId: 1,
    planId: 'plan-1',
    subscriptionId: 10,
    currentPeriodEnd: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function createPaymentFailedPayload(
  overrides: Partial<SubscriptionRenewalFailedEvent> = {},
): SubscriptionRenewalFailedEvent {
  return {
    userId: 1,
    planId: 'plan-1',
    subscriptionId: 10,
    stripeInvoiceId: 'inv_123',
    attemptCount: 1,
    nextPaymentAttempt: '2026-05-10T00:00:00Z',
    failureCode: 'card_declined',
    failureMessage: 'Your card was declined.',
    ...overrides,
  };
}

describe('PaymentsUserSyncService (unit)', () => {
  let service: PaymentsUserSyncService;
  let usersRepositoryMock: Record<keyof Pick<UsersRepository, 'updateAccountType'>, jest.Mock>;
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(async () => {
    usersRepositoryMock = {
      updateAccountType: jest.fn().mockResolvedValue(undefined),
    };

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsUserSyncService,
        { provide: UsersRepository, useValue: usersRepositoryMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get<PaymentsUserSyncService>(PaymentsUserSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applyRoutingKey() — SubscriptionActivated', () => {
    describe('позитивные сценарии', () => {
      it('currentPeriodEnd = строка ISO -> updateAccountType с new Date(...)', async () => {
        const payload: SubscriptionActivatedEvent = createPaymentCompletedPayload({
          currentPeriodEnd: '2026-05-01T00:00:00Z',
        });

        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionActivated, payload);

        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledTimes(1);
        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledWith({
          userId: 1,
          accountType: AccountType.BUSINESS,
          subscriptionActiveUntil: new Date('2026-05-01T00:00:00Z'),
        });
        expect(loggerMock.warn).not.toHaveBeenCalled();
      });

      it('currentPeriodEnd = null -> updateAccountType с subscriptionActiveUntil = null', async () => {
        const payload: SubscriptionActivatedEvent = createPaymentCompletedPayload({
          currentPeriodEnd: null,
        });

        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionActivated, payload);

        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledTimes(1);
        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledWith({
          userId: 1,
          accountType: AccountType.BUSINESS,
          subscriptionActiveUntil: null,
        });
      });
    });

    describe('валидация payload', () => {
      it('невалидный payload -> logger.warn, updateAccountType не вызван', async () => {
        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionActivated, {
          userId: 'not-a-number',
        });

        expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
        expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
      });
    });
  });

  describe('applyRoutingKey() — PaymentFailed', () => {
    describe('позитивные сценарии', () => {
      it('валидный payload -> logger.warn с userId, subscriptionId и остальными полями', async () => {
        const payload: SubscriptionRenewalFailedEvent = createPaymentFailedPayload();

        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionRenewalFailed, payload);

        expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        const warnMessage = loggerMock.warn.mock.calls[0][0] as string;
        expect(warnMessage).toContain(String(payload.userId));
        expect(warnMessage).toContain(String(payload.subscriptionId));
        expect(warnMessage).toContain(payload.stripeInvoiceId);
        expect(warnMessage).toContain(payload.failureCode);
        expect(warnMessage).toContain(payload.failureMessage);
        expect(warnMessage).toContain(String(payload.attemptCount));
        expect(warnMessage).toContain(payload.nextPaymentAttempt);
        expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
      });

      it('опциональные поля null -> logger.warn с "n/a"', async () => {
        const payload: SubscriptionRenewalFailedEvent = createPaymentFailedPayload({
          failureCode: null,
          failureMessage: null,
          nextPaymentAttempt: null,
        });

        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionRenewalFailed, payload);

        expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        const warnMessage = loggerMock.warn.mock.calls[0][0] as string;
        expect(warnMessage).toContain('n/a');
      });
    });

    describe('валидация payload', () => {
      it('невалидный payload -> logger.warn, без побочных эффектов', async () => {
        await service.applyRoutingKey(PaymentsRoutingKey.SubscriptionRenewalFailed, {});

        expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
        expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
      });
    });
  });

  describe('applyRoutingKey() — неизвестный routing key', () => {
    it('произвольный routing key -> logger.warn "Unhandled routing key"', async () => {
      await service.applyRoutingKey('SOME_UNKNOWN_KEY' as PaymentsRoutingKey, {});

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled routing key'),
      );
      expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
    });
  });
});
