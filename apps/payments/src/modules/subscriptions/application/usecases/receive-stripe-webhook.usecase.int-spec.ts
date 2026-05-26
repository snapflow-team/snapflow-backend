import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { InboxEventStatus } from '@generated/prisma-payments';
import { Notification } from '../../../../common/notification/notification';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { PaymentsModule } from '../../../../payments.module';
import { PrismaService } from '../../../database/prisma.service';
import { StripeService } from '../services/stripe.service';
import {
  ReceiveStripeWebhookCommand,
  ReceiveStripeWebhookUseCase,
} from './receive-stripe-webhook.usecase';
import { StripeEvents } from '../constants/stripe-events.constants';

const TRUNCATE_SQL =
  'TRUNCATE TABLE inbox_events, outbox_commands, outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE';

describe('ReceiveStripeWebhookUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: ReceiveStripeWebhookUseCase;
  let prisma: PrismaService;

  const constructEventMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({
        constructEvent: constructEventMock,
      })
      .compile();

    useCase = module.get(ReceiveStripeWebhookUseCase);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);
    constructEventMock.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeStripeEvent(eventId: string): Stripe.Event {
    return {
      id: eventId,
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      type: StripeEvents.CheckoutSessionCompleted,
      data: {
        object: {
          id: 'cs_test',
          object: 'checkout.session',
          subscription: 'sub_test',
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;
  }

  it('валидный event сохраняется в inbox_events со статусом PENDING', async () => {
    const event = makeStripeEvent('evt_receive_1');
    constructEventMock.mockReturnValue(Notification.ok(event));

    const result = await useCase.execute(
      new ReceiveStripeWebhookCommand({ rawBody: Buffer.from('{}'), signature: 'sig' }),
    );

    expect(result.hasErrors).toBe(false);

    const inboxEvent = await prisma.inboxEvent.findUnique({ where: { eventId: event.id } });

    expect(inboxEvent).toBeDefined();
    expect(inboxEvent?.status).toBe(InboxEventStatus.PENDING);
    expect(inboxEvent?.payload).toEqual(expect.objectContaining({ id: event.id }));
  });

  it('дубликат event.id тихо пропускается, в inbox остаётся одна запись', async () => {
    const event = makeStripeEvent('evt_receive_dup');
    constructEventMock.mockReturnValue(Notification.ok(event));

    const command = new ReceiveStripeWebhookCommand({
      rawBody: Buffer.from('{}'),
      signature: 'sig',
    });

    const first = await useCase.execute(command);
    const second = await useCase.execute(command);

    expect(first.hasErrors).toBe(false);
    expect(second.hasErrors).toBe(false);

    const count = await prisma.inboxEvent.count({ where: { eventId: event.id } });
    expect(count).toBe(1);
  });

  it('невалидная подпись возвращает BadRequest без записи в inbox', async () => {
    constructEventMock.mockReturnValue(
      Notification.fail(NotificationResultCode.BadRequest, 'Invalid webhook signature'),
    );

    const result = await useCase.execute(
      new ReceiveStripeWebhookCommand({ rawBody: Buffer.from('{}'), signature: 'bad-sig' }),
    );

    expect(result.hasErrors).toBe(true);
    expect(result.code).toBe(NotificationResultCode.BadRequest);

    const count = await prisma.inboxEvent.count();
    expect(count).toBe(0);
  });
});
