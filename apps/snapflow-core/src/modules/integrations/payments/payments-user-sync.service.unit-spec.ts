import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AccountType } from '@generated/prisma-snapflow';
import {
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentsRoutingKey,
} from '../../../../../../libs/contracts/payments';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { UsersRepository } from '../../user-accounts/users/infrastructure/users.repository';

function createPaymentCompletedPayload(
  overrides: Partial<PaymentCompletedEvent> = {},
): PaymentCompletedEvent {
  return {
    userId: 1,
    planId: 'plan-1',
    subscriptionId: 10,
    currentPeriodEnd: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function createPaymentFailedPayload(
  overrides: Partial<PaymentFailedEvent> = {},
): PaymentFailedEvent {
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

  beforeEach(async () => {
    usersRepositoryMock = {
      updateAccountType: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsUserSyncService,
        { provide: UsersRepository, useValue: usersRepositoryMock },
      ],
    }).compile();

    service = module.get<PaymentsUserSyncService>(PaymentsUserSyncService);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('applyRoutingKey() — PaymentCompleted', () => {
    describe('позитивные сценарии', () => {
      it('currentPeriodEnd = строка ISO -> updateAccountType с new Date(...)', async () => {
        const payload: PaymentCompletedEvent = createPaymentCompletedPayload({
          currentPeriodEnd: '2026-05-01T00:00:00Z',
        });

        await service.applyRoutingKey(PaymentsRoutingKey.PaymentCompleted, payload);

        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledTimes(1);
        expect(usersRepositoryMock.updateAccountType).toHaveBeenCalledWith({
          userId: 1,
          accountType: AccountType.BUSINESS,
          subscriptionActiveUntil: new Date('2026-05-01T00:00:00Z'),
        });
        expect(Logger.prototype.warn).not.toHaveBeenCalled();
      });

      it('currentPeriodEnd = null -> updateAccountType с subscriptionActiveUntil = null', async () => {
        const payload: PaymentCompletedEvent = createPaymentCompletedPayload({
          currentPeriodEnd: null,
        });

        await service.applyRoutingKey(PaymentsRoutingKey.PaymentCompleted, payload);

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
        await service.applyRoutingKey(PaymentsRoutingKey.PaymentCompleted, {
          userId: 'not-a-number',
        });

        expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
        expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
      });
    });
  });

  describe('applyRoutingKey() — PaymentFailed', () => {
    describe('позитивные сценарии', () => {
      it('валидный payload -> logger.warn с userId, subscriptionId и остальными полями', async () => {
        const payload: PaymentFailedEvent = createPaymentFailedPayload();

        await service.applyRoutingKey(PaymentsRoutingKey.PaymentFailed, payload);

        expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
        const warnMessage = (Logger.prototype.warn as jest.Mock).mock.calls[0][0] as string;
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
        const payload: PaymentFailedEvent = createPaymentFailedPayload({
          failureCode: null,
          failureMessage: null,
          nextPaymentAttempt: null,
        });

        await service.applyRoutingKey(PaymentsRoutingKey.PaymentFailed, payload);

        expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
        const warnMessage = (Logger.prototype.warn as jest.Mock).mock.calls[0][0] as string;
        expect(warnMessage).toContain('n/a');
      });
    });

    describe('валидация payload', () => {
      it('невалидный payload -> logger.warn, без побочных эффектов', async () => {
        await service.applyRoutingKey(PaymentsRoutingKey.PaymentFailed, {});

        expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid'));
        expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
      });
    });
  });

  describe('applyRoutingKey() — неизвестный routing key', () => {
    it('произвольный routing key -> logger.warn "Unhandled routing key"', async () => {
      await service.applyRoutingKey('SOME_UNKNOWN_KEY' as PaymentsRoutingKey, {});

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled routing key'),
      );
      expect(usersRepositoryMock.updateAccountType).not.toHaveBeenCalled();
    });
  });
});
