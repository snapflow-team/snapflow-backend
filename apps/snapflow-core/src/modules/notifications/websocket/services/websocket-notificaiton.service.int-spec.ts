import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { WebsocketNotificationService } from './websocket-notification.service';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';
import { WebsocketService } from './websocket.service';
import { NestApplication } from '@nestjs/core';
import { NotificationsRoutingKey } from '../../../../../../../libs/contracts/payments';
import { $Enums, Prisma } from '@generated/prisma-snapflow';
import NotificationType = $Enums.NotificationType;

describe('WebsocketNotificationService', () => {
  let appTestManager: AppTestManager;

  let service: WebsocketNotificationService;

  let websocketService: WebsocketService;

  let notificationsRepository: NotificationsRepository;

  let app: NestApplication;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    app = appTestManager.getApp();

    service = app.get(WebsocketNotificationService);

    websocketService = app.get(WebsocketService);

    notificationsRepository = app.get(NotificationsRepository);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);

    jest.restoreAllMocks();
  });

  it('должен сохранить уведомление об активации подписки и отправить его пользователю', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    const dataForUser = {
      username: 'user',
      email: 'email@mail.ro',
      password: 'somePassHash',
    };

    const createdUser = await appTestManager.prisma.user.create({ data: dataForUser });

    const payload = {
      userId: createdUser.id,
      expireAt: '2027-01-01',
    };

    await service.applyRoutingKey(NotificationsRoutingKey.SubscriptionActivated, payload);

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).not.toBeNull();

    expect(notification!.userId).toBe(1);

    expect(notification!.type).toBe(NotificationType.SUBSCRIPTION_ACTIVATED);

    expect(notification!.message).toContain('Ваша подписка активирована');

    expect(sendSpy).toHaveBeenCalledTimes(1);

    expect(sendSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        message: expect.stringContaining('Ваша подписка активирована'),
      }),
    );
  });
  it('должен сохранить уведомление об истечении подписки через 7 дней и отправить его пользователю', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    const createdUser = await createUser();

    const payload = {
      userId: createdUser.id,
      expireAt: '2027-01-01',
    };

    await service.applyRoutingKey(NotificationsRoutingKey.SubscriptionExpiringIn7Days, payload);

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(createdUser.id);
    expect(notification!.type).toBe(NotificationType.SUBSCRIPTION_EXPIRING_7D);
    expect(notification!.message).toContain('Ваша подписка истекает через 7 дней');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      createdUser.id,
      expect.objectContaining({
        type: NotificationType.SUBSCRIPTION_EXPIRING_7D,
        message: expect.stringContaining('Ваша подписка истекает через 7 дней'),
      }),
    );
  });
  it('должен сохранить уведомление об истечении подписки через 1 день и отправить его пользователю', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    const createdUser = await createUser();

    const payload = {
      userId: createdUser.id,
      expireAt: '2027-01-01',
    };

    await service.applyRoutingKey(NotificationsRoutingKey.SubscriptionExpiringIn1Day, payload);

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(createdUser.id);
    expect(notification!.type).toBe(NotificationType.SUBSCRIPTION_EXPIRING_1D);
    expect(notification!.message).toContain('Ваша подписка истекает через 1 день');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      createdUser.id,
      expect.objectContaining({
        type: NotificationType.SUBSCRIPTION_EXPIRING_1D,
        message: expect.stringContaining('Ваша подписка истекает через 1 день'),
      }),
    );
  });
  it('должен сохранить уведомление о следующем платеже и отправить его пользователю', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    const createdUser = await createUser();

    const payload = {
      userId: createdUser.id,
      nextPaymentAt: '2027-01-01',
    };

    await service.applyRoutingKey(NotificationsRoutingKey.NextPaymentReminderIn1Day, payload);

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(createdUser.id);
    expect(notification!.type).toBe(NotificationType.NEXT_PAYMENT_1D);
    expect(notification!.message).toContain('Следующий платеж у вас спишется через 1 день');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      createdUser.id,
      expect.objectContaining({
        type: NotificationType.NEXT_PAYMENT_1D,
        message: expect.stringContaining('Следующий платеж у вас спишется через 1 день'),
      }),
    );
  });
  it('не должен сохранять уведомление и отправлять сообщение при невалидном payload', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    await service.applyRoutingKey(NotificationsRoutingKey.SubscriptionActivated, {});

    const count = await appTestManager.prisma.notification.count();

    expect(count).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });
  it('не должен ничего делать для неизвестного routing key', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    await service.applyRoutingKey('unknown.routing.key' as NotificationsRoutingKey, {});

    const count = await appTestManager.prisma.notification.count();

    expect(count).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });
  it('не должен отправлять websocket сообщение, если не удалось сохранить уведомление', async () => {
    const sendSpy = jest.spyOn(websocketService, 'sendToUser');

    jest.spyOn(notificationsRepository, 'create').mockRejectedValue(new Error('DB error'));

    const createdUser = await createUser();

    await service.applyRoutingKey(NotificationsRoutingKey.SubscriptionActivated, {
      userId: createdUser.id,
      expireAt: '2027-01-01',
    });

    expect(sendSpy).not.toHaveBeenCalled();
  });
  it('должен сохранить уведомление, даже если отправка по websocket завершилась ошибкой', async () => {
    jest.spyOn(websocketService, 'sendToUser').mockImplementation(() => {
      throw new Error('Socket error');
    });

    const createdUser = await createUser();

    await expect(
      service.applyRoutingKey(NotificationsRoutingKey.SubscriptionActivated, {
        userId: createdUser.id,
        expireAt: '2027-01-01',
      }),
    ).resolves.toBeUndefined();

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(createdUser.id);
    expect(notification!.type).toBe(NotificationType.SUBSCRIPTION_ACTIVATED);
  });
  async function createUser() {
    return appTestManager.prisma.user.create({
      data: {
        username: 'user',
        email: 'email@mail.ru',
        password: 'passwordHash',
      },
    });
  }
});
