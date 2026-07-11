import { HttpService } from '@nestjs/axios';
import request from 'supertest';
import { of, throwError } from 'rxjs';
import { GLOBAL_PREFIX } from '../../../../../../libs/common/constants/global-prefix.constant';
import { AppTestManager } from '../../../../test/managers/app.test-manager';

describe('MessagingController (Integration)', () => {
  let appTestManager: AppTestManager;
  let httpServiceGetMock: jest.Mock;

  beforeAll(async () => {
    httpServiceGetMock = jest.fn();

    appTestManager = new AppTestManager();
    await appTestManager.init((builder) => {
      builder.overrideProvider(HttpService).useValue({
        get: httpServiceGetMock,
      });
    });
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    httpServiceGetMock.mockReset();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function mockAuthenticatedUser(userId: number) {
    httpServiceGetMock.mockReturnValue(
      of({
        data: {
          userId: String(userId),
          email: 'user@example.com',
          username: 'user',
        },
      }),
    );
  }

  it('должен вернуть 201 и созданное сообщение при валидном запросе', async () => {
    mockAuthenticatedUser(1);

    const response = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        receiverId: '2',
        text: 'Hello!',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        chatId: '1',
        senderId: '1',
        receiverId: '2',
        text: 'Hello!',
        createdAt: expect.any(String),
      }),
    );

    const messageCount = await appTestManager.prisma.message.count();
    const chatCount = await appTestManager.prisma.chat.count();

    expect(messageCount).toBe(1);
    expect(chatCount).toBe(1);
  });

  it('должен вернуть 400 при пустом или пробельном тексте сообщения', async () => {
    mockAuthenticatedUser(1);

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        receiverId: '2',
        text: '   ',
      })
      .expect(400);

    const messageCount = await appTestManager.prisma.message.count();
    expect(messageCount).toBe(0);
  });

  it('должен вернуть 401 без authorization header', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .send({
        receiverId: '2',
        text: 'Hello!',
      })
      .expect(401);

    expect(httpServiceGetMock).not.toHaveBeenCalled();
  });

  it('должен вернуть 401 при невалидном токене', async () => {
    httpServiceGetMock.mockReturnValue(throwError(() => new Error('Unauthorized')));

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', 'Bearer invalid-token')
      .send({
        receiverId: '2',
        text: 'Hello!',
      })
      .expect(401);
  });
});
