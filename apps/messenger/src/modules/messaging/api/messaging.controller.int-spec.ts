import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../libs/common/constants/global-prefix.constant';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { AppTestManager } from '../../../../test/managers/app.test-manager';

describe('MessagingController (Integration)', () => {
  let appTestManager: AppTestManager;
  let signAccessToken: (userId: number) => string;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    signAccessToken = (userId: number) => jwtService.sign({ userId }, { expiresIn: '1h' });
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть 201 и созданное сообщение при валидном запросе', async () => {
    const response = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${signAccessToken(1)}`)
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
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${signAccessToken(1)}`)
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
  });

  it('должен вернуть 401 при невалидном токене', async () => {
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
