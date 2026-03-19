import { Server } from 'http';
import request, { Response } from 'supertest';
import { HttpStatus } from '@nestjs/common';

import { AppTestManager } from '../managers/app.test-manager';

import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';

describe('UsersController - getTotalCount() (GET: /users/total-count)', () => {
  let appTestManager: AppTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть { totalCount: 0 }, если в базе данных нет ни одного пользователя', async () => {
    // 🔻 1. Делаем GET запрос к эндпоинту
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/total-count`)
      .expect(HttpStatus.OK);

    // 🔻 2. Проверяем, что вернулся 0
    expect(response.body).toEqual({
      totalCount: 0,
    });
  });

  it('должен вернуть правильное количество пользователей, игнорируя удаленных (soft-deleted)', async () => {
    // 🔻 1. Регистрируем создаем 3-х пользователей
    await appTestManager.prisma.user.createMany({
      data: [
        { username: 'user1', email: '1@test.com', password: 'hash1' },
        { username: 'user2', email: '2@test.com', password: 'hash2' },
        {
          username: 'user3',
          email: '3@test.com',
          password: 'hash3',
          deletedAt: new Date(), // Этот пользователь удален, он не должен учитываться
        },
      ],
    });

    // 🔻 2. Делаем GET запрос к эндпоинт
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/total-count`)
      .expect(HttpStatus.OK);

    // 🔻 3. Проверяем, что посчитались только 2 активных пользователя
    expect(response.body).toEqual({
      totalCount: 2,
    });
  });

  it('должен вернуть 429 TOO_MANY_REQUESTS при превышении лимита Throttler (лимит 5 запросов за 10 сек)', async () => {
    // 🔻 1. Делаем 5 успешных запросов подряд (исчерпываем лимит)
    for (let i = 0; i < 5; i++) {
      await request(server).get(`/${GLOBAL_PREFIX}/users/total-count`).expect(HttpStatus.OK);
    }

    // 🔻 2. Делаем 6-й запрос и ожидаем, что сработает защита (ThrottlerGuard)
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/total-count`)
      .expect(HttpStatus.TOO_MANY_REQUESTS);
  });
});
